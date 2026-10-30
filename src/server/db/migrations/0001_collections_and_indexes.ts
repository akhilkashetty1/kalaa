import type { Db, IndexDescription } from "mongodb";
import { COLLECTIONS } from "../collections";
import type { Migration } from ".";

// Every collection, created up front (so transactions never have to create one), and every index the
// queries in server/ rely on. Unique indexes enforce the rules the old JSON store checked in code:
// one account per email, one site per slug or custom domain, one learner per email per site.

const ttl = (key: string): IndexDescription => ({ key: { [key]: 1 }, name: `${key}_ttl`, expireAfterSeconds: 0 });

const INDEXES: Record<string, IndexDescription[]> = {
  [COLLECTIONS.creators]: [{ key: { email: 1 }, name: "email_unique", unique: true }],
  [COLLECTIONS.sessions]: [{ key: { creatorId: 1 }, name: "creatorId" }, ttl("expiresAt")],
  [COLLECTIONS.loginCodes]: [{ key: { scope: 1, email: 1, createdAt: -1 }, name: "scope_email_newest" }, ttl("expiresAt")],
  [COLLECTIONS.rateLimits]: [ttl("expiresAt")],
  [COLLECTIONS.sites]: [
    { key: { slug: 1 }, name: "slug_unique", unique: true },
    { key: { "domain.hostname": 1 }, name: "domain_hostname_unique", unique: true, partialFilterExpression: { "domain.hostname": { $type: "string" } } },
    { key: { ownerId: 1 }, name: "ownerId" },
    { key: { listed: 1 }, name: "listed" },
  ],
  [COLLECTIONS.memberships]: [
    { key: { siteId: 1, creatorId: 1 }, name: "site_creator_unique", unique: true },
    { key: { creatorId: 1 }, name: "creatorId" },
  ],
  [COLLECTIONS.invites]: [
    { key: { tokenHash: 1 }, name: "tokenHash_unique", unique: true },
    { key: { siteId: 1, email: 1 }, name: "site_email_unique", unique: true },
  ],
  [COLLECTIONS.audit]: [{ key: { siteId: 1, at: -1 }, name: "site_newest" }],
  [COLLECTIONS.courses]: [
    { key: { siteId: 1, slug: 1 }, name: "site_slug_unique", unique: true },
    { key: { siteId: 1, published: 1 }, name: "site_published" },
    { key: { "lessons.files.id": 1 }, name: "lesson_file_ids" },
  ],
  [COLLECTIONS.enrollments]: [
    { key: { siteId: 1, createdAt: -1 }, name: "site_newest" },
    { key: { siteId: 1, email: 1 }, name: "site_email" },
    { key: { courseId: 1, status: 1 }, name: "course_status" },
  ],
  [COLLECTIONS.learners]: [{ key: { siteId: 1, email: 1 }, name: "site_email_unique", unique: true }],
  [COLLECTIONS.learnerSessions]: [{ key: { learnerId: 1 }, name: "learnerId" }, ttl("expiresAt")],
  [COLLECTIONS.progress]: [{ key: { siteId: 1, learnerId: 1 }, name: "site_learner" }],
  [COLLECTIONS.files]: [{ key: { siteId: 1, createdAt: 1 }, name: "site_created" }],
  [COLLECTIONS.announcements]: [{ key: { siteId: 1, sentAt: -1 }, name: "site_newest" }],
  [COLLECTIONS.migrations]: [],
  [COLLECTIONS.locks]: [],
};

async function ensureCollection(db: Db, name: string) {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (!exists) await db.createCollection(name);
}

const migration: Migration = {
  id: "0001_collections_and_indexes",
  description: "Create collections and indexes",
  async up(db) {
    for (const [name, indexes] of Object.entries(INDEXES)) {
      await ensureCollection(db, name);
      if (indexes.length) await db.collection(name).createIndexes(indexes);
    }
  },
  async down(db) {
    for (const [name, indexes] of Object.entries(INDEXES)) {
      for (const ix of indexes) await db.collection(name).dropIndex(ix.name!).catch(() => undefined);
    }
  },
};

export default migration;
