import "server-only";
import { promises as dns } from "node:dns";
import { CNAME_TARGET, ROOT_DOMAIN, isLocalHost, stripPort } from "@/lib/config";
import type { CustomDomain } from "@/lib/types";

const HOSTNAME = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;

/** Turns "https://Learn.Example.in/path" into "learn.example.in", or explains what's wrong. */
export function normalizeHostname(input: string): { hostname: string } | { error: string } {
  const hostname = stripPort(
    input.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, ""),
  );
  if (!HOSTNAME.test(hostname)) return { error: "Enter a domain like learn.yourname.in" };
  const root = stripPort(ROOT_DOMAIN);
  // Hosts under the platform domain belong to Kalaa. In local dev (root "localhost") only
  // single-label hosts like foo.localhost collide with site slugs; deeper ones are test domains.
  const underRoot = hostname === root || hostname.endsWith(`.${root}`);
  const collides = isLocalHost(root) ? hostname.split(".").length <= 2 : underRoot;
  if (collides) {
    return { error: `Your free ${ROOT_DOMAIN} address already works. Add a domain you own instead.` };
  }
  return { hostname };
}

const cloudflare = () => {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  return token && zone ? { token, zone } : null;
};

type CfHostname = { id: string; status: string; ssl?: { status?: string } };

async function cfRequest(path: string, init: RequestInit = {}) {
  const cf = cloudflare()!;
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${cf.zone}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${cf.token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const body = (await res.json()) as { success: boolean; result: unknown; errors?: { message: string }[] };
  if (!body.success) throw new Error(body.errors?.[0]?.message ?? `Cloudflare returned ${res.status}`);
  return body.result;
}

/** Registers (or re-reads) the hostname with Cloudflare for SaaS, which issues the SSL certificate. */
async function syncCloudflare(domain: CustomDomain): Promise<CustomDomain> {
  const result = domain.cloudflareId
    ? ((await cfRequest(`/custom_hostnames/${domain.cloudflareId}`)) as CfHostname)
    : ((await cfRequest("/custom_hostnames", {
        method: "POST",
        body: JSON.stringify({ hostname: domain.hostname, ssl: { method: "http", type: "dv" } }),
      })) as CfHostname);
  const sslActive = result.ssl?.status === "active";
  return {
    ...domain,
    cloudflareId: result.id,
    status: sslActive ? "active" : "issuing",
    message: sslActive ? "DNS verified and SSL certificate active." : `DNS verified. SSL is being issued (${result.ssl?.status ?? "pending"}).`,
  };
}

// Vercel for Platforms: when the app runs on Vercel, each creator domain is added to the project, and
// Vercel issues and renews its certificate. Needs a token with access to the project.
const vercel = () => {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  return token && projectId ? { token, projectId, teamId: process.env.VERCEL_TEAM_ID } : null;
};

async function vercelRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const v = vercel()!;
  const url = new URL(`https://api.vercel.com${path}`);
  if (v.teamId) url.searchParams.set("teamId", v.teamId);
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${v.token}`, "Content-Type": "application/json" }, cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { code?: string; message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? `Vercel returned ${res.status}`);
  return body;
}

/** Adds the hostname to the Vercel project if it isn't there yet, then reads whether it is verified and correctly pointed. */
async function syncVercel(domain: CustomDomain): Promise<CustomDomain> {
  const { projectId } = vercel()!;
  const project = `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain.hostname)}`;
  let state = await vercelRequest<{ verified: boolean }>(project).catch(() => null);
  if (!state) {
    await vercelRequest(`/v10/projects/${encodeURIComponent(projectId)}/domains`, { method: "POST", body: JSON.stringify({ name: domain.hostname }) });
    state = await vercelRequest<{ verified: boolean }>(project);
  }
  if (!state.verified) state = await vercelRequest<{ verified: boolean }>(`${project}/verify`, { method: "POST" }).catch(() => state!);
  const config = await vercelRequest<{ misconfigured: boolean }>(`/v6/domains/${encodeURIComponent(domain.hostname)}/config`);
  const live = state.verified && !config.misconfigured;
  return {
    ...domain,
    status: live ? "active" : "issuing",
    message: live ? "DNS verified and SSL certificate active." : "DNS verified. Vercel is finishing setup and issuing SSL, which can take a few minutes.",
  };
}

/** Checks the creator's DNS record and moves the domain to its next status. */
export async function verifyDomain(domain: CustomDomain): Promise<CustomDomain> {
  const checkedAt = new Date().toISOString();

  // *.localhost resolves to this machine, so local test domains skip the DNS lookup.
  if (domain.hostname.endsWith(".localhost")) {
    return { ...domain, checkedAt, status: "active", message: "Local test domain, so the DNS check was skipped." };
  }

  let records: string[] = [];
  try {
    records = (await dns.resolveCname(domain.hostname)).map((r) => r.toLowerCase().replace(/\.$/, ""));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    const message =
      code === "ENOTFOUND"
        ? `We couldn't find ${domain.hostname} in DNS yet. New records can take up to an hour to appear.`
        : code === "ENODATA"
          ? `${domain.hostname} has no CNAME record. Add one that points to ${CNAME_TARGET}.`
          : `DNS lookup failed (${code ?? "unknown error"}). Try again in a few minutes.`;
    return { ...domain, checkedAt, status: "error", message };
  }

  if (!records.includes(CNAME_TARGET)) {
    return {
      ...domain,
      checkedAt,
      status: "error",
      message: `The CNAME points to ${records.join(", ")}. Change it to ${CNAME_TARGET}.`,
    };
  }

  if (vercel()) {
    try {
      return { ...(await syncVercel(domain)), checkedAt };
    } catch (err) {
      return { ...domain, checkedAt, status: "error", message: `DNS is correct, but connecting the domain failed: ${(err as Error).message}` };
    }
  }
  if (!cloudflare()) {
    return { ...domain, checkedAt, status: "active", message: "DNS verified. SSL is handled by your edge proxy." };
  }
  try {
    return { ...(await syncCloudflare(domain)), checkedAt };
  } catch (err) {
    return { ...domain, checkedAt, status: "error", message: `DNS is correct, but SSL setup failed: ${(err as Error).message}` };
  }
}

export async function releaseDomain(domain: CustomDomain) {
  if (vercel()) {
    const { projectId } = vercel()!;
    await vercelRequest(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain.hostname)}`, { method: "DELETE" }).catch(() => undefined);
  }
  if (cloudflare() && domain.cloudflareId) {
    await cfRequest(`/custom_hostnames/${domain.cloudflareId}`, { method: "DELETE" }).catch(() => undefined);
  }
}
