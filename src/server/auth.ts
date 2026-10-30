import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE } from "@/lib/config";
import { sendMail } from "@/server/mail";
import { checkCode, issueCode, normalizeEmail } from "@/server/otp";
import { ROLE_META, can, type Permission } from "@/lib/roles";
import { db, fromDoc } from "@/server/db";
import { getSiteBySlug, roleOn } from "@/server/data/sites";
import type { Creator } from "@/lib/types";

// Passwordless studio sign-in: a 6-digit code is emailed, and entering it starts a session.
// Only hashes of codes and session tokens are stored. The session cookie is host-only on the
// platform domain, so it is never sent to creator storefronts.

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export { normalizeEmail };

export type CodeRequest = { ok: true } | { ok: false; reason: "rate_limited" };

/** Creates and emails a sign-in code. Works for new and existing creators alike. */
export async function requestLoginCode(email: string): Promise<CodeRequest> {
  const issued = await issueCode("creator", email);
  if (!issued.ok) return issued;
  const { code } = issued;
  await sendMail({
    to: email,
    subject: `${code} is your Kalaa sign-in code`,
    text: `Your Kalaa sign-in code is ${code}.\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<p>Your Kalaa sign-in code is</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p><p>It expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`,
  });
  return { ok: true };
}

export type CodeCheck = { ok: true; creator: Creator } | { ok: false; reason: "invalid" | "expired" | "locked" };

/** Checks a code against the newest live code for the email. Signs the creator up on first success. */
export async function verifyLoginCode(email: string, code: string): Promise<CodeCheck> {
  const result = await checkCode("creator", email, code);
  if (result !== "ok") return { ok: false, reason: result };
  const local = email.split("@")[0].replace(/[._-]+/g, " ");
  // Upsert on the unique email index: two sign-ins racing for a new address still make one account.
  const doc = await (await db()).creators.findOneAndUpdate(
    { email },
    { $setOnInsert: { _id: randomUUID(), name: local.replace(/\b\w/g, (ch) => ch.toUpperCase()), createdAt: new Date().toISOString() } },
    { upsert: true, returnDocument: "after" },
  );
  return { ok: true, creator: fromDoc<Creator>(doc!) };
}

export async function startSession(creatorId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  // Expired sessions are removed by a TTL index.
  await (await db()).sessions.insertOne({ _id: sha256(token), creatorId, createdAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await (await db()).sessions.deleteOne({ _id: sha256(token) });
  jar.delete(SESSION_COOKIE);
}

/** The signed-in creator for this request, or null. */
export const currentCreator = cache(async (): Promise<Creator | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const c = await db();
  // TTL deletion runs about once a minute, so expiry is also checked here.
  const session = await c.sessions.findOne({ _id: sha256(token), expiresAt: { $gt: new Date() } });
  const creator = session && (await c.creators.findOne({ _id: session.creatorId }));
  return creator ? fromDoc<Creator>(creator) : null;
});

/** For studio pages: sends signed-out visitors to the sign-in page. */
export async function requireCreator(next = "/studio") {
  const creator = await currentCreator();
  if (!creator) redirect(`/login?next=${encodeURIComponent(next)}`);
  return creator;
}

/** Thrown by `assertSiteAccess`; the message is safe to show to the person. */
export class AccessError extends Error {}

/**
 * For studio pages under /studio/[slug]. Someone with no role on the site gets a 404, the same as for a
 * site that doesn't exist. Someone with a role but not `permission` gets `allowed: false`, so the page
 * can explain instead of pretending the page is missing.
 */
export async function requireSiteAccess(slug: string, permission?: Permission) {
  const creator = await requireCreator(`/studio/${slug}`);
  const site = await getSiteBySlug(slug);
  const role = site ? await roleOn(site, creator.id) : null;
  if (!site || !role) notFound();
  return { creator, site, role, allowed: !permission || can(role, permission) };
}

/** For server actions: throws instead of redirecting, since actions are public endpoints anyone can call. */
export async function assertSiteAccess(slug: string, permission?: Permission) {
  const creator = await currentCreator();
  if (!creator) throw new AccessError("Your session ended. Sign in again.");
  const site = await getSiteBySlug(slug);
  const role = site ? await roleOn(site, creator.id) : null;
  if (!site || !role) throw new AccessError("You no longer have access to this site.");
  if (permission && !can(role, permission)) throw new AccessError(`Your role (${ROLE_META[role].label}) can't do that.`);
  return { creator, site, role };
}

/** Only allows redirects back into the studio or an invitation page, never to another site. */
export function safeNext(next: unknown) {
  return typeof next === "string" && /^(\/(?:studio|editor)(\/[a-z0-9-]*)*(\?industry=[a-z]+)?|\/invite\/[A-Za-z0-9_-]{20,64})$/.test(next) ? next : "/studio";
}
