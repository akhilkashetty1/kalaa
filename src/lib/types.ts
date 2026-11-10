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

/** An extra page of a site (About, Contact, a campaign landing page...). The home page is `Site.blocks`. */
export type SitePage = { id: string; title: string; slug: string; description: string; inMenu: boolean; blocks: Block[] };

/** A link in the header or footer. `href` is "#section", "/page" or an https address. */
export type NavLink = { id: string; label: string; href: string };
export type SocialKind = "instagram" | "youtube" | "whatsapp" | "telegram" | "x" | "facebook" | "linkedin" | "email";

/**
 * Everything around the page: the brand kit, header, announcement bar and footer. Images are library
 * paths ("/api/media/<id>") or https links. Absent on sites that predate it; lib/chrome.ts fills defaults.
 */
export type SiteChrome = {
  brand: { logo: string; logoDark: string; favicon: string; share: string; showName: boolean };
  nav: { auto: boolean; links: NavLink[]; ctaLabel: string; ctaHref: string; showCta: boolean; showAccount: boolean };
  announcement: { enabled: boolean; text: string; href: string };
  /** A message that appears once the page has been open a few seconds. */
  popup: { enabled: boolean; title: string; text: string; buttonLabel: string; buttonHref: string; delay: number; repeat: "once" | "daily" | "always" };
  /** Tracking IDs. Only the validated ID is ever put on the page; no free-form scripts. */
  analytics: { ga: string; meta: string };
  footer: { tagline: string; links: NavLink[]; socials: { id: string; kind: SocialKind; url: string }[]; showBuiltWith: boolean };
};

/** A custom section a teacher saved to reuse on any page of their site. `props` is a validated custom section (lib/custom.ts). */
export type SavedSection = { id: string; siteId: string; name: string; props: Record<string, unknown>; createdBy: string; createdAt: string };

/** A file in a site's media library. */
export type MediaItem = { id: string; siteId: string; name: string; alt: string; size: number; type: string; width?: number; height?: number; uploadedBy: string; createdAt: string };

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
  /** Brand kit, header, announcement bar and footer. */
  chrome?: SiteChrome;
  /** Extra pages, each served at /<slug>. */
  pages?: SitePage[];
  /** What every course page looks like: sections above and below the fixed "course details" block (type "coursecore"). */
  courseTemplate?: Block[];
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
  /** Optional cohort size. When set, the storefront shows how many seats are left (reservations count, paid or not). */
  seats?: number;
  lessons: Lesson[];
  published: boolean;
  createdAt: string;
};

export type LeadStatus = "new" | "contacted" | "closed";
/** Someone who filled in a form on the storefront. `form` is the form's title, `source` the page it was on. */
export type Lead = {
  id: string;
  siteId: string;
  form: string;
  source: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  answers: { label: string; value: string }[];
  /** True when the visitor ticked the consent box the form asked for. */
  consent: boolean;
  status: LeadStatus;
  createdAt: string;
};

/** Everything the editor publishes. A snapshot is a draft that was or will be published. */
export type SiteSnapshot = SiteDraft;
/** A published state of a site, kept so a teacher can go back to it. */
export type SiteVersion = { id: string; siteId: string; createdAt: string; by: string; label: string; snapshot: SiteSnapshot };
/** A publish set for later. Applied by the cron job (or the next time a teammate opens the editor). */
export type ScheduledPublish = { id: string; siteId: string; at: string; by: string; status: "pending" | "running" | "done" | "failed"; error?: string; createdAt: string; snapshot: SiteSnapshot };

/**
 * A course as the storefront's client components may see it. Lesson links and attached files are left out:
 * everything here is sent to every visitor's browser, and locked lessons must stay locked.
 * `seatsLeft` is set only when the teacher set a seat limit.
 */
export type PublicCourse = Pick<Course, "id" | "slug" | "title" | "summary" | "priceInr" | "mrpInr" | "tag"> & { lessons: Pick<Lesson, "title" | "minutes" | "free">[]; seatsLeft?: number };

export function publicCourse(c: Course, seatsLeft?: number): PublicCourse {
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    summary: c.summary,
    priceInr: c.priceInr,
    mrpInr: c.mrpInr,
    tag: c.tag,
    lessons: c.lessons.map((l) => ({ title: l.title, minutes: l.minutes, free: l.free })),
    ...(seatsLeft !== undefined ? { seatsLeft } : {}),
  };
}

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
export type SiteDraft = { name: string; theme: Theme; blocks: Block[]; chrome: SiteChrome; pages: SitePage[]; courseTemplate: Block[] };

/** A learner's progress through one course. Lessons are keyed by title so reordering keeps progress. */
/** An email a teacher sent to the paid students of one course. */
export type Announcement = { id: string; siteId: string; courseId: string; courseTitle: string; subject: string; body: string; sentBy: string; sentAt: string; recipients: number; delivered: number; failed: number };

export type Progress = { learnerId: string; courseId: string; siteId: string; completed: string[]; lastLesson: string; updatedAt: string };
