// Database command line. Run through npm scripts (see package.json), which load .env.local the same way
// `next dev` does:
//
//   npm run db:migrate            apply pending migrations
//   npm run db:status             list migrations and whether each is applied
//   npm run db:rollback           revert the last migration (development only)
//   npm run db:seed               add sample data (only to *_dev, *_test or *_preview databases)
//   npm run db:setup              migrate + seed: everything a fresh local database needs
//   npm run db:reset              drop the local database and set it up again
//   npm run db:new <name>         create the next migration file
//   npm run db:import-json [file] copy the old .data/db.json store into MongoDB (idempotent)

import { promises as fs } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { closeMongo, mongoConfig, mongoDb } from "@/server/db/client";
import { collectionsOf } from "@/server/db/collections";
import { migrateDown, migrateUp, migrationStatus } from "@/server/db/migrate";
import { assertSeedable, seedDatabase } from "@/server/db/seed";
import { emptyDataset, loadDataset, writeDataset, type Dataset } from "@/server/db/seed/dataset";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const [command, ...args] = process.argv.slice(2);

async function importJson(file = path.join(process.cwd(), ".data", "db.json")) {
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as Partial<Dataset> & {
    sessions?: { tokenHash: string; creatorId: string; expiresAt: string; createdAt: string }[];
    learnerSessions?: { tokenHash: string; learnerId: string; siteId: string; expiresAt: string; createdAt: string }[];
  };
  const db = mongoDb();
  const c = collectionsOf(db);
  const incoming = { ...emptyDataset(), ...Object.fromEntries(Object.entries(raw).filter(([k]) => k in emptyDataset())) } as Dataset;
  const written = await writeDataset(c, incoming, await loadDataset(c));

  // Keep people signed in across the move. Expired sessions are skipped (and would be removed by TTL anyway).
  const now = Date.now();
  let sessions = 0;
  for (const s of raw.sessions ?? []) {
    if (Date.parse(s.expiresAt) <= now) continue;
    await c.sessions.updateOne({ _id: s.tokenHash }, { $setOnInsert: { creatorId: s.creatorId, createdAt: new Date(s.createdAt), expiresAt: new Date(s.expiresAt) } }, { upsert: true });
    sessions++;
  }
  for (const s of raw.learnerSessions ?? []) {
    if (Date.parse(s.expiresAt) <= now) continue;
    await c.learnerSessions.updateOne({ _id: s.tokenHash }, { $setOnInsert: { learnerId: s.learnerId, siteId: s.siteId, createdAt: new Date(s.createdAt), expiresAt: new Date(s.expiresAt) } }, { upsert: true });
    sessions++;
  }
  console.log(`Imported ${written} records and ${sessions} live sessions from ${path.relative(process.cwd(), file)} into ${db.databaseName}.`);
}

async function newMigration(name: string | undefined) {
  if (!name || !/^[a-z0-9_]+$/.test(name)) throw new Error("Usage: npm run db:new <snake_case_name>");
  const dir = path.join(process.cwd(), "src", "server", "db", "migrations");
  const numbers = (await fs.readdir(dir)).map((f) => Number(f.slice(0, 4))).filter(Number.isFinite);
  const id = `${String(Math.max(0, ...numbers) + 1).padStart(4, "0")}_${name}`;
  const file = path.join(dir, `${id}.ts`);
  await fs.writeFile(
    file,
    `import type { Migration } from ".";

// Must be safe to run twice, and must work with the code that is live while the deploy builds.

const migration: Migration = {
  id: "${id}",
  description: "${name.replace(/_/g, " ")}",
  async up(db) {
    void db;
  },
  async down(db) {
    void db;
  },
};

export default migration;
`,
  );
  console.log(`Created ${path.relative(process.cwd(), file)}. Add it to the end of MIGRATIONS in migrations/index.ts.`);
}

async function main() {
  switch (command) {
    case "migrate":
      await migrateUp(mongoDb());
      break;
    case "status":
      console.log(`Database: ${mongoConfig().dbName}`);
      for (const m of await migrationStatus(mongoDb())) console.log(`${m.appliedAt ? "✓" : "·"} ${m.id}  ${m.appliedAt ? m.appliedAt.toISOString() : "pending"}`);
      break;
    case "rollback":
      assertSeedable(mongoConfig().dbName); // never on production
      await migrateDown(mongoDb());
      break;
    case "seed":
      await seedDatabase(mongoDb());
      break;
    case "setup":
      await migrateUp(mongoDb());
      await seedDatabase(mongoDb());
      break;
    case "reset": {
      const db = mongoDb();
      assertSeedable(db.databaseName);
      await db.dropDatabase();
      console.log(`Dropped ${db.databaseName}.`);
      await migrateUp(db);
      await seedDatabase(db);
      break;
    }
    case "new":
      await newMigration(args[0]);
      break;
    case "import-json":
      await importJson(args[0]);
      break;
    default:
      throw new Error(`Unknown command "${command ?? ""}". See the top of scripts/db.ts.`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeMongo());
