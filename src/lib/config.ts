// Platform-wide settings. NEXT_PUBLIC_ so the value is inlined into middleware too.
export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase();
export const CNAME_TARGET = (process.env.CNAME_TARGET ?? "edge.kalaa.so").toLowerCase();

/** Studio session cookie. Lives here (not lib/auth) so edge middleware can import it. */
export const SESSION_COOKIE = "kalaa_session";

const ROOT_PORT = ROOT_DOMAIN.split(":")[1];

// Slugs that would collide with platform hosts.
export const RESERVED_SLUGS = new Set(["www", "app", "api", "studio", "admin", "static", "assets", "mail", "edge"]);

export function stripPort(host: string) {
  return host.replace(/:\d+$/, "");
}

export function isLocalHost(hostname: string) {
  const h = stripPort(hostname);
  return h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1";
}

/**
 * Hosts that serve the platform (landing page + studio) rather than a creator site. Vercel's own
 * *.vercel.app deployment URLs count too, so preview deployments open the platform; no creator can
 * own a vercel.app name.
 */
export function isPlatformHost(host: string) {
  const h = host.toLowerCase();
  return h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}` || h === `app.${ROOT_DOMAIN}` || stripPort(h) === "127.0.0.1" || h.endsWith(".vercel.app");
}

export function subdomainOrigin(slug: string) {
  const host = `${slug}.${ROOT_DOMAIN}`;
  return `${isLocalHost(host) ? "http" : "https"}://${host}`;
}

export function customDomainOrigin(hostname: string) {
  return isLocalHost(hostname) ? `http://${hostname}${ROOT_PORT ? `:${ROOT_PORT}` : ""}` : `https://${hostname}`;
}

export function platformOrigin() {
  return `${isLocalHost(ROOT_DOMAIN) ? "http" : "https"}://${ROOT_DOMAIN}`;
}
