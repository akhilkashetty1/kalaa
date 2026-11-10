import { normalizeEmail } from "@/server/auth";
import { appSite, fail, json, limited, readJson } from "@/server/app-api";
import { requestLearnerCode } from "@/server/learner-auth";

// Emails a six-digit sign-in code. The same reply whether or not the address has an account.
export async function POST(req: Request) {
  const site = await appSite();
  if (!site) return fail(404, "Unknown school.");
  if (await limited("code", 20)) return fail(429, "Too many requests. Try again later.");
  const email = normalizeEmail(String((await readJson(req)).email ?? ""));
  if (!email) return fail(400, "Enter a valid email address.");
  try {
    const res = await requestLearnerCode(site, email);
    if (!res.ok) return fail(429, "Too many codes requested. Try again later.");
  } catch (err) {
    console.error(err);
    return fail(502, "We couldn't send the code. Try again.");
  }
  return json({ ok: true });
}
