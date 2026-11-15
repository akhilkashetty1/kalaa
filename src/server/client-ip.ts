import "server-only";
import { headers } from "next/headers";

// The visitor's IP address, for per-client abuse limits. Never stored in the clear.
//
// Which header to believe depends on what sits in front of the app, so it is configuration, not a guess:
// - Vercel (default): the first entry of X-Forwarded-For, which Vercel's edge overwrites.
// - Own server behind Cloudflare: CLIENT_IP_HEADER=cf-connecting-ip. Cloudflare sets it on every request, and
//   the server's firewall only admits Cloudflare, so nobody can send their own. Without this setting every
//   visitor would appear as a Cloudflare edge address and share one limit.
// Never set CLIENT_IP_HEADER where clients can reach the app directly: they could then pick any IP they like.

const TRUSTED_HEADER = (process.env.CLIENT_IP_HEADER ?? "").trim().toLowerCase();

export async function clientIp(): Promise<string> {
  const h = await headers();
  if (TRUSTED_HEADER) {
    const value = h.get(TRUSTED_HEADER)?.split(",")[0]?.trim();
    if (value) return value;
  }
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
