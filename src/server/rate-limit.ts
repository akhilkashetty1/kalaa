import "server-only";
import { db } from "@/server/db";

// Fixed-window abuse limits shared by every server instance. One atomic upsert per check, so two
// requests at the same moment can't both slip under the limit. Counters expire with their window (TTL).

/** Counts one use of `name` by `subject`. Returns false (and counts nothing more) once `limit` is reached in the window. */
export async function takeToken(name: string, subject: string, limit: number, windowMs: number): Promise<boolean> {
  const { rateLimits } = await db();
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const key = `${name}:${subject}:${windowStart}`;
  const doc = await rateLimits.findOneAndUpdate(
    { _id: key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs) } },
    { upsert: true, returnDocument: "after" },
  );
  return (doc?.count ?? 1) <= limit;
}
