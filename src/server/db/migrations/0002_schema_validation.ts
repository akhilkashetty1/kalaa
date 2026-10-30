import type { Document } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from ".";

// Server-side guard rails: MongoDB rejects a write that would leave a record without the fields every
// query relies on, whatever code path it came from. Only the core fields are checked; optional ones and
// new fields can be added in code without a migration. "moderate" leaves any older invalid document
// alone until it is next updated.

const str = { bsonType: "string" };
const num = { bsonType: "number" };
const bool = { bsonType: "bool" };
const date = { bsonType: "date" };
const obj = { bsonType: "object" };
const arr = { bsonType: "array" };
const enumOf = (...values: string[]) => ({ enum: values });

const schema = (properties: Record<string, Document>) => ({
  $jsonSchema: { bsonType: "object", required: Object.keys(properties), properties },
});

const VALIDATORS: Record<string, Document> = {
  [COLLECTIONS.creators]: schema({ email: str, name: str, createdAt: str }),
  [COLLECTIONS.sessions]: schema({ creatorId: str, createdAt: date, expiresAt: date }),
  [COLLECTIONS.loginCodes]: schema({ scope: str, email: str, codeHash: str, attempts: num, createdAt: date, expiresAt: date }),
  [COLLECTIONS.rateLimits]: schema({ count: num, expiresAt: date }),
  [COLLECTIONS.sites]: schema({ ownerId: str, slug: str, name: str, theme: obj, createdAt: str }),
  [COLLECTIONS.memberships]: schema({ siteId: str, creatorId: str, role: enumOf("coowner", "editor", "support"), createdAt: str }),
  [COLLECTIONS.invites]: schema({ siteId: str, email: str, role: enumOf("coowner", "editor", "support"), tokenHash: str, expiresAt: str }),
  [COLLECTIONS.audit]: schema({ siteId: str, actorId: str, action: str, detail: str, at: str }),
  [COLLECTIONS.courses]: schema({ siteId: str, slug: str, title: str, priceInr: num, lessons: arr, published: bool, createdAt: str }),
  [COLLECTIONS.enrollments]: schema({ siteId: str, courseId: str, email: str, status: enumOf("pending_payment", "paid"), createdAt: str }),
  [COLLECTIONS.learners]: schema({ siteId: str, email: str, name: str, createdAt: str }),
  [COLLECTIONS.learnerSessions]: schema({ learnerId: str, siteId: str, createdAt: date, expiresAt: date }),
  [COLLECTIONS.progress]: schema({ siteId: str, learnerId: str, courseId: str, completed: arr, updatedAt: str }),
  [COLLECTIONS.files]: schema({ siteId: str, name: str, size: num, type: str, createdAt: str }),
  [COLLECTIONS.announcements]: schema({ siteId: str, courseId: str, subject: str, sentAt: str, recipients: num }),
};

const migration: Migration = {
  id: "0002_schema_validation",
  description: "Require core fields on every collection",
  async up(db) {
    for (const [name, validator] of Object.entries(VALIDATORS)) {
      await db.command({ collMod: name, validator, validationLevel: "moderate", validationAction: "error" });
    }
  },
  async down(db) {
    for (const name of Object.keys(VALIDATORS)) await db.command({ collMod: name, validator: {}, validationLevel: "off" });
  },
};

export default migration;
