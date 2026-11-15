import "server-only";
import { headers } from "next/headers";
import { clientIp } from "@/server/client-ip";
import { getSiteByHost } from "@/server/data";
import { learnerByToken } from "@/server/learner-auth";
import { takeToken } from "@/server/rate-limit";
import type { Learner, Site } from "@/lib/types";

// Shared plumbing for /api/app/v1, the JSON API the mobile apps call. The tenant comes from the Host header
// (the app talks to the teacher's own address, exactly like a browser), and a learner is a bearer token that
// belongs to that one site. Nothing here trusts a site id sent in the body.

const NO_STORE = { "Cache-Control": "no-store" };
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
export const fail = (status: number, error: string) => json({ ok: false, error }, status);

export async function appSite(): Promise<Site | null> {
  return getSiteByHost(((await headers()).get("host") ?? "").toLowerCase());
}

export const bearer = (req: Request) => /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";

export async function appLearner(site: Site, req: Request): Promise<Learner | null> {
  return learnerByToken(site.id, bearer(req));
}

/** Per-client abuse limit for the unauthenticated endpoints. Keyed by IP (see client-ip.ts). */
export async function limited(name: string, limit: number, windowMs = 60 * 60 * 1000) {
  return !(await takeToken(`app:${name}`, await clientIp(), limit, windowMs));
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
