import { COLLECTIONS } from "../collections";
import type { Migration } from ".";

// Custom sections a teacher saved to reuse. Adds a collection and an index only.

const name = COLLECTIONS.savedSections;

const migration: Migration = {
  id: "0004_saved_sections",
  description: "Saved custom sections collection",
  async up(db) {
    if (!(await db.listCollections({ name }, { nameOnly: true }).hasNext())) await db.createCollection(name);
    await db.collection(name).createIndexes([{ key: { siteId: 1, createdAt: -1 }, name: "site_newest" }]);
    await db.command({
      collMod: name,
      validator: { $jsonSchema: { bsonType: "object", required: ["siteId", "name", "props", "createdAt"], properties: { siteId: { bsonType: "string" }, name: { bsonType: "string" }, props: { bsonType: "object" }, createdAt: { bsonType: "string" } } } },
      validationLevel: "moderate",
      validationAction: "error",
    });
  },
  async down(db) {
    await db.collection(name).drop().catch(() => undefined);
  },
};

export default migration;
