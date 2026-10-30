import type { ClientSession } from "mongodb";
import { mongoClient, mongoDb } from "./client";
import { collectionsOf, type Collections } from "./collections";

// Multi-document writes that must succeed or fail together run in a transaction. Transactions need a
// replica set: Atlas always is one, and README → Database shows the two commands that make a local
// mongod one. A standalone local server still works in development, without the all-or-nothing guarantee,
// and the app says so once in the log. Production refuses to run on a standalone server.

export type Tx = { c: Collections; session: ClientSession | undefined };

const g = globalThis as unknown as { __kalaaTxSupport?: Promise<boolean> };

async function supportsTransactions() {
  g.__kalaaTxSupport ??= mongoDb()
    .admin()
    .command({ hello: 1 })
    .then((hello) => Boolean(hello.setName) || hello.msg === "isdbgrid")
    .catch((err) => {
      g.__kalaaTxSupport = undefined; // retry on the next call
      throw err;
    });
  const ok = await g.__kalaaTxSupport;
  if (!ok) {
    if (process.env.NODE_ENV === "production") throw new Error("MongoDB is a standalone server. Transactions need a replica set (Atlas always is one).");
    if (!(globalThis as { __kalaaTxWarned?: boolean }).__kalaaTxWarned) {
      (globalThis as { __kalaaTxWarned?: boolean }).__kalaaTxWarned = true;
      console.warn("[kalaa db] Local MongoDB is not a replica set, so multi-document writes run without a transaction. See README → Database.");
    }
  }
  return ok;
}

/**
 * Runs `fn` in a transaction and returns its result. The driver retries the whole callback on transient
 * errors and write conflicts, so `fn` must only touch the database: send email after it returns.
 * Pass `session` to every operation inside.
 */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const c = collectionsOf(mongoDb());
  if (!(await supportsTransactions())) return fn({ c, session: undefined });
  return mongoClient().withSession((session) =>
    session.withTransaction(() => fn({ c, session }), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    }),
  );
}

/**
 * Makes concurrent transactions on one site conflict, so they run one after another. Snapshot isolation
 * alone lets two transactions each read the team, then write different documents (one removes a member
 * while that member invites someone). Both bump the site's `_rev`, so the second one is retried and sees
 * the first one's change.
 */
export async function lockSite({ c, session }: Tx, siteId: string) {
  await c.sites.updateOne({ _id: siteId }, { $inc: { _rev: 1 } }, { session });
}

/** MongoDB's duplicate-key error: a unique index rejected the write. */
export const isDuplicateKey = (err: unknown) => (err as { code?: number } | null)?.code === 11000;
