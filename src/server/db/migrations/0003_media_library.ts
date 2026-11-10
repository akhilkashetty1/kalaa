import { COLLECTIONS } from "../collections";
import type { Migration } from ".";

// The media library: one record per uploaded image. The bytes live in the BlobStore.
// Adds a collection and indexes only, so the previous release keeps working against it.

const name = COLLECTIONS.media;

const migration: Migration = {
  id: "0003_media_library",
  description: "Media library collection",
  async up(db) {
    if (!(await db.listCollections({ name }, { nameOnly: true }).hasNext())) await db.createCollection(name);
    await db.collection(name).createIndexes([{ key: { siteId: 1, createdAt: -1 }, name: "site_newest" }]);
    await db.command({
      collMod: name,
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["siteId", "name", "size", "type", "createdAt"],
          properties: { siteId: { bsonType: "string" }, name: { bsonType: "string" }, size: { bsonType: "number" }, type: { bsonType: "string" }, createdAt: { bsonType: "string" } },
        },
      },
      validationLevel: "moderate",
      validationAction: "error",
    });
  },
  async down(db) {
    await db.collection(name).drop().catch(() => undefined);
  },
};

export default migration;
