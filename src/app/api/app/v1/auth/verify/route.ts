import { normalizeEmail } from "@/server/auth";
import { appSite, fail, json, limited, readJson } from "@/server/app-api";
import { createLearnerSession, verifyLearnerCode } from "@/server/learner-auth";

// Exchanges the emailed code for a bearer token. The code engine locks after repeated wrong tries.
export async function POST(req: Request) {
  const site = await appSite();
  if (!site) return fail(404, "Unknown school.");
  if (await limited("verify", 60)) return fail(429, "Too many requests. Try again later.");
  const body = await readJson(req);
  const email = normalizeEmail(String(body.email ?? ""));
  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!email || code.length !== 6) return fail(400, "Enter your email and the 6-digit code.");
  const res = await verifyLearnerCode(site, email, code);
  if (!res.ok) return fail(res.reason === "locked" ? 429 : 401, { invalid: "That code isn't right.", expired: "That code has expired. Ask for a new one.", locked: "Too many wrong tries. Ask for a new code." }[res.reason]);
  const token = await createLearnerSession(site, res.learner.id);
  return json({ ok: true, token, learner: { id: res.learner.id, name: res.learner.name, email: res.learner.email } });
}
