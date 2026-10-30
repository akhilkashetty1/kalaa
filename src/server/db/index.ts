import "server-only";
import { connection } from "next/server";
import { mongoDb } from "./client";
import { collectionsOf } from "./collections";

export { fromDoc, toDoc, progressId, type Collections, type Doc } from "./collections";
export { withTransaction, lockSite, isDuplicateKey, type Tx } from "./transaction";

/**
 * The collections, for app code. `connection()` marks the caller as dynamic, so a page never reads the
 * database at build time and serves stale data. Scripts outside Next (KALAA_SCRIPT=1) have no request to mark.
 */
export async function db() {
  if (!process.env.KALAA_SCRIPT) await connection();
  return collectionsOf(mongoDb());
}
