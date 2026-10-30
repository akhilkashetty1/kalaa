import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { collectionsOf } from "./collections";
import { MIGRATIONS, type Migration } from "./migrations";

// Schema migrations: numbered files in ./migrations, applied in order and recorded in `_migrations`.
// A lock document keeps two deploys from migrating at once. Each migration must be safe to re-run
// (create-if-missing, update-where-not-yet-updated), because a crash can leave one half applied.
//
// Rule for zero-downtime deploys: a migration must work with both the old and the new code, because the
// old deployment keeps serving while the new one builds. Add fields and indexes first; remove them in a
// later release once nothing reads them.

const LOCK_ID = "migrations";
const LOCK_TTL_MS = 10 * 60 * 1000;

async function acquireLock(db: Db) {
  const { locks } = collectionsOf(db);
  const holder = randomUUID();
  // A lock left behind by a crashed run expires.
  await locks.deleteOne({ _id: LOCK_ID, expiresAt: { $lt: new Date() } });
  try {
    await locks.insertOne({ _id: LOCK_ID, holder, expiresAt: new Date(Date.now() + LOCK_TTL_MS) });
  } catch {
    throw new Error("Another migration is running (or crashed less than 10 minutes ago). Try again shortly.");
  }
  return () => locks.deleteOne({ _id: LOCK_ID, holder });
}

export async function migrationStatus(db: Db) {
  const applied = new Map((await collectionsOf(db).migrations.find().toArray()).map((m) => [m._id, m.appliedAt]));
  return MIGRATIONS.map((m) => ({ id: m.id, description: m.description, appliedAt: applied.get(m.id) ?? null }));
}

/** Applies every pending migration in order. Returns the ids applied. */
export async function migrateUp(db: Db, log: (line: string) => void = console.log) {
  const release = await acquireLock(db);
  try {
    const { migrations } = collectionsOf(db);
    const applied = new Set((await migrations.find({}, { projection: { _id: 1 } }).toArray()).map((m) => m._id));
    const done: string[] = [];
    for (const m of MIGRATIONS) {
      if (applied.has(m.id)) continue;
      const started = Date.now();
      log(`→ ${m.id}: ${m.description}`);
      await m.up(db);
      await migrations.insertOne({ _id: m.id, appliedAt: new Date(), durationMs: Date.now() - started });
      done.push(m.id);
    }
    log(done.length ? `Applied ${done.length} migration${done.length === 1 ? "" : "s"}.` : "Database is up to date.");
    return done;
  } finally {
    await release();
  }
}

/** Reverts the most recently applied migration. For development; production rolls forward with a new migration. */
export async function migrateDown(db: Db, log: (line: string) => void = console.log) {
  const release = await acquireLock(db);
  try {
    const { migrations } = collectionsOf(db);
    const last = await migrations.find().sort({ _id: -1 }).limit(1).next();
    if (!last) return log("Nothing to revert.");
    const m: Migration | undefined = MIGRATIONS.find((x) => x.id === last._id);
    if (!m?.down) throw new Error(`${last._id} can't be reverted automatically.`);
    log(`← ${m.id}`);
    await m.down(db);
    await migrations.deleteOne({ _id: m.id });
  } finally {
    await release();
  }
}
