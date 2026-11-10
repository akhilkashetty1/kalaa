import type { Db, IndexDescription } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from ".";

// Form submissions (leads), kept versions of a published site, and publishes set for later.
// Adds collections and indexes only, so the previous release keeps working against it.

const INDEXES: Record<string, IndexDescription[]> = {
  [COLLECTIONS.leads]: [
    { key: { siteId: 1, createdAt: -1 }, name: "site_newest" },
    { key: { siteId: 1, status: 1 }, name: "site_status" },
  ],
  [COLLECTIONS.siteVersions]: [{ key: { siteId: 1, createdAt: -1 }, name: "site_newest" }],
  [COLLECTIONS.scheduledPublishes]: [
    { key: { status: 1, at: 1 }, name: "due" },
    { key: { siteId: 1, createdAt: -1 }, name: "site_newest" },
  ],
};

const REQUIRED: Record<string, string[]> = {
  [COLLECTIONS.leads]: ["siteId", "form", "name", "email", "status", "createdAt"],
  [COLLECTIONS.siteVersions]: ["siteId", "createdAt", "snapshot"],
  [COLLECTIONS.scheduledPublishes]: ["siteId", "at", "status", "snapshot"],
};

const migration: Migration = {
  id: "0005_leads_versions_schedules",
  description: "Leads, site versions and scheduled publishes",
  async up(db: Db) {
    for (const [name, indexes] of Object.entries(INDEXES)) {
      if (!(await db.listCollections({ name }, { nameOnly: true }).hasNext())) await db.createCollection(name);
      await db.collection(name).createIndexes(indexes);
      await db.command({
        collMod: name,
        validator: { $jsonSchema: { bsonType: "object", required: REQUIRED[name] } },
        validationLevel: "moderate",
        validationAction: "error",
      });
    }
  },
  async down(db: Db) {
    for (const name of Object.keys(INDEXES)) await db.collection(name).drop().catch(() => undefined);
  },
};

export default migration;
