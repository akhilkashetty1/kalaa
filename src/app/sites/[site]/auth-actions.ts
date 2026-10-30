"use server";

import { normalizeEmail } from "@/server/auth";
import { endLearnerSession, requestLearnerCode, safeLearnerNext, startLearnerSession, verifyLearnerCode } from "@/server/learner-auth";
import { t } from "@/lib/i18n";
import { siteFromHost } from "@/server/tenant";

// Learner sign-in for a storefront. The site comes from the request's Host header, never from an
// argument the page could have tampered with. These return state instead of redirecting: a redirect
// from a server action skips the host rewrite in middleware, so the browser navigates itself on "done".

export type LearnerLoginState = { step: "email" | "code" | "done"; email?: string; error?: string; notice?: string; next?: string };

async function send(prev: LearnerLoginState, formData: FormData): Promise<LearnerLoginState> {
  const site = await siteFromHost();
  const s = t(site.theme.lang);
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email) return { step: "email", error: s.errEmail };
  try {
    const res = await requestLearnerCode(site, email);
    if (!res.ok) return { step: "code", email, error: s.errTooMany };
  } catch (err) {
    console.error(err);
    return { step: "email", email, error: s.errSend };
  }
  // The same reply whether or not the address has an account, so this can't be used to look people up.
  return { step: "code", email, notice: `${s.codeSent} ${email}` };
}

async function check(prev: LearnerLoginState, formData: FormData): Promise<LearnerLoginState> {
  const site = await siteFromHost();
  const s = t(site.theme.lang);
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (!email) return { step: "email", error: s.errEmail };
  if (code.length !== 6) return { step: "code", email, error: s.errShort };

  const res = await verifyLearnerCode(site, email, code);
  if (!res.ok) return { step: "code", email, error: { invalid: s.errInvalid, expired: s.errExpired, locked: s.errLocked }[res.reason] };
  await startLearnerSession(site, res.learner.id);
  return { step: "done", next: safeLearnerNext(formData.get("next")) };
}

/** One entry point for the form; the pressed button's `intent` picks the step. */
export async function learnerLoginStep(prev: LearnerLoginState, formData: FormData): Promise<LearnerLoginState> {
  switch (formData.get("intent")) {
    case "check":
      return check(prev, formData);
    case "reset":
      return { step: "email", email: String(formData.get("email") ?? "") };
    default:
      return send(prev, formData);
  }
}

export async function learnerSignOut() {
  await siteFromHost(); // only meaningful on a storefront host
  await endLearnerSession();
}
