import type { Theme } from "./theme";

export type DomainStatus = "pending" | "issuing" | "active" | "error";

export type CustomDomain = {
  hostname: string;
  status: DomainStatus;
  message?: string;
  checkedAt?: string;
  cloudflareId?: string;
};

/** One section of a storefront page. `props` is validated against the block type's field list (lib/blocks.ts). */
export type Block = { id: string; type: string; tone?: string; hidden?: boolean; props: Record<string, unknown> };

export type LiveBatch = { id: string; title: string; startsOn: string; schedule: string; seatsLeft: number };
export type Quote = { id: string; text: string; author: string; detail: string };

export type Role = "owner" | "coowner" | "editor" | "support";
/** Roles stored as memberships. The owner is `Site.ownerId`, never a membership. */
export type TeamRole = Exclude<Role, "owner">;

/** A teammate on a site. */
export type Membership = { id: string; siteId: string; creatorId: string; role: TeamRole; addedBy: string; createdAt: string };

/** A pending invitation. Bound to one email address; only a hash of the link token is stored. */
export type Invite = {
  id: string;
  siteId: string;
  email: string;
  role: TeamRole;
  tokenHash: string;
  invitedBy: string;
  createdAt: string;
  lastSentAt: string;
  expiresAt: string;
};

export type AuditAction = "invite" | "invite_resend" | "invite_revoke" | "join" | "role_change" | "remove" | "leave" | "transfer" | "payment" | "payment_revoke" | "course_delete" | "announce";
export type AuditEntry = { id: string; siteId: string; actorId: string; actorEmail: string; action: AuditAction; detail: string; at: string };

export type Creator = { id: string; email: string; name: string; createdAt: string };

export type Site = {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  headline: string;
  headlineHi?: string;
  bio: string;
  creator: { name: string; title: string; rating: number };
  stats: { learners: number; rating: number; results: number; resultsLabel: string };
  live: LiveBatch[];
  quotes: Quote[];
  community: { title: string; body: string; cta: string };
  theme: Theme;
  /** The home page. Sites saved before the page builder have none and get one derived from their old settings. */
  blocks?: Block[];
  domain?: CustomDomain;
  /** Which kind of teaching business this is (a template id). Drives Explore filters. */
  category?: string;
  /** Show this site on Kalaa's public Explore page. On unless the creator turns it off. */
  listed?: boolean;
  /** Where learners send money. Shown after they reserve a seat. */
  upiId?: string;
  payNote?: string;
  createdAt: string;
};

/** `url` is the lesson material: a YouTube or Vimeo link plays inline, any other https link opens in a new tab. */
/** A downloadable file attached to a lesson (PDF, slides, worksheet…). The bytes live on the server; only this is stored with the lesson. */
export type LessonFile = { id: string; name: string; size: number; type: string };
export type StoredFile = LessonFile & { siteId: string; uploadedBy: string; createdAt: string };

export type Lesson = { title: string; minutes: number; free: boolean; url?: string; files?: LessonFile[] };

export type Course = {
  id: string;
  siteId: string;
  slug: string;
  title: string;
  summary: string;
  priceInr: number;
  mrpInr?: number;
  tag?: string;
  lessons: Lesson[];
  published: boolean;
  createdAt: string;
};

export type Enrollment = {
  id: string;
  siteId: string;
  courseId: string;
  name: string;
  email: string;
  phone: string;
  status: "pending_payment" | "paid";
  createdAt: string;
  /** Set when a teammate confirms payment; this is what grants access to the course. */
  paidAt?: string;
  paidBy?: string;
};

/** A student on one creator's storefront. Accounts are per site: the same email on two sites is two accounts. */
export type Learner = { id: string; siteId: string; email: string; name: string; createdAt: string };

/** The editable brand fields the studio sends when saving. */
export type BrandDraft = Pick<Site, "name" | "headline" | "bio" | "theme">;

/** What the visual editor publishes. */
export type SiteDraft = { name: string; theme: Theme; blocks: Block[] };

/** A learner's progress through one course. Lessons are keyed by title so reordering keeps progress. */
/** An email a teacher sent to the paid students of one course. */
export type Announcement = { id: string; siteId: string; courseId: string; courseTitle: string; subject: string; body: string; sentBy: string; sentAt: string; recipients: number; delivered: number; failed: number };

export type Progress = { learnerId: string; courseId: string; siteId: string; completed: string[]; lastLesson: string; updatedAt: string };
