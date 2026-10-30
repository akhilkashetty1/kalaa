import type { Db } from "mongodb";
import type { Announcement, AuditEntry, Course, Creator, Enrollment, Invite, Learner, Membership, Progress, Site, StoredFile } from "@/lib/types";

// Collection names and document shapes. The app's types (lib/types.ts) use `id`; documents store it as
// `_id`, so lookups by id use the primary index. `fromDoc`/`toDoc` convert at the edge of the data layer.
//
// Timestamps on domain records are ISO-8601 UTC strings: they sort and compare correctly as strings and
// stay JSON-safe across the server/client boundary. Fields that expire records are BSON Dates, because
// TTL indexes only work on Dates.

type WithId = { id: string };
export type Doc<T extends WithId> = Omit<T, "id"> & { _id: string };

/** One-time sign-in code. Only a hash is stored; the code itself is emailed. Removed by TTL once expired. */
export type LoginCodeDoc = { _id: string; scope: string; email: string; codeHash: string; attempts: number; createdAt: Date; expiresAt: Date };
/** Studio session. `_id` is the SHA-256 of the cookie value, so a leaked database can't be replayed. */
export type SessionDoc = { _id: string; creatorId: string; createdAt: Date; expiresAt: Date };
/** Storefront learner session, bound to one site. `_id` is the token hash. */
export type LearnerSessionDoc = { _id: string; learnerId: string; siteId: string; createdAt: Date; expiresAt: Date };
/** Fixed-window counter for abuse limits. `_id` is "<limit name>:<subject>:<window start>". */
export type RateLimitDoc = { _id: string; count: number; expiresAt: Date };
/** `_id` is "<learnerId>:<courseId>". */
export type ProgressDoc = Progress & { _id: string };
/** `_rev` is bumped by team transactions so concurrent ones on the same site conflict and retry (see db/transaction.ts). */
export type SiteDoc = Doc<Site> & { _rev?: number };

export type MigrationDoc = { _id: string; appliedAt: Date; durationMs: number };
export type LockDoc = { _id: string; holder: string; expiresAt: Date };

export const COLLECTIONS = {
  creators: "creators",
  sessions: "sessions",
  loginCodes: "login_codes",
  rateLimits: "rate_limits",
  sites: "sites",
  memberships: "memberships",
  invites: "invites",
  audit: "audit_log",
  courses: "courses",
  enrollments: "enrollments",
  learners: "learners",
  learnerSessions: "learner_sessions",
  progress: "progress",
  files: "files",
  announcements: "announcements",
  migrations: "_migrations",
  locks: "_locks",
} as const;

export function collectionsOf(db: Db) {
  return {
    creators: db.collection<Doc<Creator>>(COLLECTIONS.creators),
    sessions: db.collection<SessionDoc>(COLLECTIONS.sessions),
    loginCodes: db.collection<LoginCodeDoc>(COLLECTIONS.loginCodes),
    rateLimits: db.collection<RateLimitDoc>(COLLECTIONS.rateLimits),
    sites: db.collection<SiteDoc>(COLLECTIONS.sites),
    memberships: db.collection<Doc<Membership>>(COLLECTIONS.memberships),
    invites: db.collection<Doc<Invite>>(COLLECTIONS.invites),
    audit: db.collection<Doc<AuditEntry>>(COLLECTIONS.audit),
    courses: db.collection<Doc<Course>>(COLLECTIONS.courses),
    enrollments: db.collection<Doc<Enrollment>>(COLLECTIONS.enrollments),
    learners: db.collection<Doc<Learner>>(COLLECTIONS.learners),
    learnerSessions: db.collection<LearnerSessionDoc>(COLLECTIONS.learnerSessions),
    progress: db.collection<ProgressDoc>(COLLECTIONS.progress),
    files: db.collection<Doc<StoredFile>>(COLLECTIONS.files),
    announcements: db.collection<Doc<Announcement>>(COLLECTIONS.announcements),
    migrations: db.collection<MigrationDoc>(COLLECTIONS.migrations),
    locks: db.collection<LockDoc>(COLLECTIONS.locks),
  };
}

export type Collections = ReturnType<typeof collectionsOf>;

/** A stored document as the app's type: `_id` becomes `id`, and internal fields (`_rev`) are dropped. */
export function fromDoc<T extends WithId>(doc: Doc<T>): T {
  const { _id, _rev, ...rest } = doc as Doc<T> & { _rev?: number };
  void _rev;
  return { id: _id, ...rest } as unknown as T;
}

export function toDoc<T extends WithId>(value: T): Doc<T> {
  const { id, ...rest } = value;
  return { _id: id, ...rest } as Doc<T>;
}

export const progressId = (learnerId: string, courseId: string) => `${learnerId}:${courseId}`;
