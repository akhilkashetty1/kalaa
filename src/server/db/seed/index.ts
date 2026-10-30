import type { Db } from "mongodb";
import { collectionsOf } from "../collections";
import { loadDataset, writeDataset } from "./dataset";
import { addDemoContent } from "./demo";
import { seedDataset } from "./seed";

// Sample data for development and preview databases: two sample creators with a team, five demo teachers
// and a demo student. An empty database gets everything; an existing one only gets the demo content it is
// missing, and your own records are never changed.

/** Seeding is refused on any database whose name doesn't end in _dev, _test or _preview, so it can't reach production by accident. */
export function assertSeedable(dbName: string) {
  if (!/_(dev|test|preview)$/.test(dbName)) {
    throw new Error(`Refusing to seed "${dbName}". Sample data only goes into databases named *_dev, *_test or *_preview.`);
  }
}

export async function seedDatabase(db: Db, log: (line: string) => void = console.log) {
  assertSeedable(db.databaseName);
  const c = collectionsOf(db);
  const empty = (await c.sites.countDocuments({}, { limit: 1 })) === 0 && (await c.creators.countDocuments({}, { limit: 1 })) === 0;
  if (empty) {
    const written = await writeDataset(c, seedDataset());
    log(`Seeded ${written} records into an empty database.`);
    return;
  }
  const before = await loadDataset(c);
  const after = structuredClone(before);
  if (!addDemoContent(after)) return log("Sample data is already in place.");
  log(`Added ${await writeDataset(c, after, before)} missing demo records.`);
}
