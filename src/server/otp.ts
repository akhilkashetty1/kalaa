import "server-only";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { takeToken } from "@/server/rate-limit";

// Email one-time codes, shared by creator sign-in (scope "creator") and each storefront's learner
// sign-in (scope "learner:<siteId>"). The scope is part of what is hashed and what is matched, so a
// code issued for one can never be used for the other. Only hashes are stored, and expired codes are
// removed by a TTL index.

const CODE_TTL_MS = 10 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_CODE = 5;
const MAX_CODES_PER_EMAIL = 5;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hashCode = (scope: string, email: string, code: string) => sha256(`${scope}:${email}:${code}`);

export function normalizeEmail(input: string) {
  const email = input.trim().toLowerCase().slice(0, 254);
  return EMAIL.test(email) ? email : null;
}

export type IssueResult = { ok: true; code: string } | { ok: false; reason: "rate_limited" };

/**
 * Stores a new code and returns it for the caller to email. `maxPerHourInScope` caps the whole scope,
 * so a public sign-in form can't be used to mail-bomb strangers at scale.
 */
export async function issueCode(scope: string, email: string, opts: { maxPerHourInScope?: number } = {}): Promise<IssueResult> {
  if (!(await takeToken("otp-email", `${scope}:${email}`, MAX_CODES_PER_EMAIL, WINDOW_MS))) return { ok: false, reason: "rate_limited" };
  if (opts.maxPerHourInScope && !(await takeToken("otp-scope", scope, opts.maxPerHourInScope, HOUR_MS))) return { ok: false, reason: "rate_limited" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();
  const { loginCodes } = await db();
  await loginCodes.insertOne({
    _id: randomUUID(),
    scope,
    email,
    codeHash: hashCode(scope, email, code),
    attempts: 0,
    createdAt: new Date(now),
    expiresAt: new Date(now + CODE_TTL_MS),
  });
  return { ok: true, code };
}

export type CheckResult = "ok" | "invalid" | "expired" | "locked";

/**
 * Checks a code against the newest live one. Each guess first claims one of the code's five attempts in a
 * single atomic update, so parallel guesses can't get more than five tries between them. A correct code is
 * used up: only the request that deletes it succeeds.
 */
export async function checkCode(scope: string, email: string, code: string): Promise<CheckResult> {
  const { loginCodes } = await db();
  const now = new Date();
  const live = await loginCodes.find({ scope, email, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(1).next();
  if (!live) return "expired";

  const claimed = await loginCodes.findOneAndUpdate({ _id: live._id, attempts: { $lt: MAX_ATTEMPTS_PER_CODE } }, { $inc: { attempts: 1 } }, { returnDocument: "after" });
  if (!claimed) return "locked";

  const expected = Buffer.from(claimed.codeHash, "hex");
  const actual = Buffer.from(hashCode(scope, email, code), "hex");
  if (!timingSafeEqual(expected, actual)) return claimed.attempts >= MAX_ATTEMPTS_PER_CODE ? "locked" : "invalid";

  const used = await loginCodes.deleteOne({ _id: claimed._id });
  if (!used.deletedCount) return "expired";
  await loginCodes.deleteMany({ scope, email });
  return "ok";
}
