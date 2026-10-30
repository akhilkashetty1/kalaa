import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, fromDoc } from "@/server/db";
import { escapeHtml, oneLine, sendMail } from "@/server/mail";
import { checkCode, issueCode } from "@/server/otp";
import type { Learner, Site } from "@/lib/types";

// Learner sign-in on a creator's storefront: same emailed-code flow as the studio, but accounts,
// codes and sessions are all scoped to one site. The cookie is host-only, so it only ever reaches
// the storefront that issued it, and it is checked against that site again on every request.

export const LEARNER_COOKIE = "kalaa_learner";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CODES_PER_HOUR_PER_SITE = 100;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const scope = (siteId: string) => `learner:${siteId}`;

export async function requestLearnerCode(site: Site, email: string): Promise<{ ok: true } | { ok: false; reason: "rate_limited" }> {
  const issued = await issueCode(scope(site.id), email, { maxPerHourInScope: MAX_CODES_PER_HOUR_PER_SITE });
  if (!issued.ok) return issued;
  const { code } = issued;
  const name = oneLine(site.name);
  await sendMail({
    to: email,
    subject: `${code} is your ${name} sign-in code`,
    text: `Your ${name} sign-in code is ${code}.\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<p>Your <b>${escapeHtml(name)}</b> sign-in code is</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p><p>It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`,
  });
  return { ok: true };
}

export type LearnerCheck = { ok: true; learner: Learner } | { ok: false; reason: "invalid" | "expired" | "locked" };

/** Checks the code and creates the learner's account on first success. */
export async function verifyLearnerCode(site: Site, email: string, code: string): Promise<LearnerCheck> {
  const result = await checkCode(scope(site.id), email, code);
  if (result !== "ok") return { ok: false, reason: result };
  const c = await db();
  const existing = await c.learners.findOne({ siteId: site.id, email });
  if (existing) return { ok: true, learner: fromDoc<Learner>(existing) };
  // Prefer the name they gave when reserving a seat.
  const reserved = await c.enrollments.find({ siteId: site.id, email }).sort({ createdAt: -1 }).limit(1).next();
  const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
  const doc = await c.learners.findOneAndUpdate(
    { siteId: site.id, email },
    { $setOnInsert: { _id: randomUUID(), name: (reserved?.name || local).slice(0, 80), createdAt: new Date().toISOString() } },
    { upsert: true, returnDocument: "after" },
  );
  return { ok: true, learner: fromDoc<Learner>(doc!) };
}

export async function startLearnerSession(site: Site, learnerId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  // Expired sessions are removed by a TTL index.
  await (await db()).learnerSessions.insertOne({ _id: sha256(token), learnerId, siteId: site.id, createdAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) });
  (await cookies()).set(LEARNER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endLearnerSession() {
  const jar = await cookies();
  const token = jar.get(LEARNER_COOKIE)?.value;
  if (token) await (await db()).learnerSessions.deleteOne({ _id: sha256(token) });
  jar.delete(LEARNER_COOKIE);
}

/** The signed-in learner for this storefront, or null. A session issued by another site never matches. */
export const currentLearner = cache(async (siteId: string): Promise<Learner | null> => {
  const token = (await cookies()).get(LEARNER_COOKIE)?.value;
  if (!token) return null;
  const c = await db();
  const session = await c.learnerSessions.findOne({ _id: sha256(token), siteId, expiresAt: { $gt: new Date() } });
  const learner = session && (await c.learners.findOne({ _id: session.learnerId, siteId }));
  return learner ? fromDoc<Learner>(learner) : null;
});

/** Only allows returning to the library, a course page or a lesson on the same storefront. */
export function safeLearnerNext(next: unknown) {
  return typeof next === "string" && /^\/(?:my-courses|courses\/[a-z0-9-]+|learn\/[a-z0-9-]+(?:\?lesson=\d{1,3})?)$/.test(next) ? next : "/my-courses";
}
