import "server-only";
import { randomUUID } from "node:crypto";
import { ROOT_DOMAIN, stripPort } from "@/lib/config";
import { roleIn } from "@/lib/roles";
import { TEMPLATES, starterBlocks, type TemplateId } from "@/lib/templates";
import { DEFAULT_THEME, LOOKS } from "@/lib/theme";
import type { BrandDraft, Course, CustomDomain, Role, Site, SiteDraft } from "@/lib/types";
import { db, fromDoc, isDuplicateKey, toDoc, withTransaction, type Tx } from "@/server/db";

export async function getSiteBySlug(slug: string) {
  const doc = await (await db()).sites.findOne({ slug });
  return doc ? fromDoc<Site>(doc) : null;
}

/** The creator's role on a site, or null if they have no access. Read from the database every time, so removal takes effect at once. */
export async function roleOn(site: Pick<Site, "id" | "ownerId">, creatorId: string, tx?: Tx): Promise<Role | null> {
  if (site.ownerId === creatorId) return "owner";
  const memberships = tx ? tx.c.memberships : (await db()).memberships;
  const m = await memberships.findOne({ siteId: site.id, creatorId }, { session: tx?.session });
  return m?.role ?? null;
}

/** Every site the creator has a role on, with that role. */
export async function listSitesFor(creatorId: string) {
  const c = await db();
  const memberships = await c.memberships.find({ creatorId }).toArray();
  const docs = await c.sites.find({ $or: [{ ownerId: creatorId }, { _id: { $in: memberships.map((m) => m.siteId) } }] }).sort({ createdAt: 1 }).toArray();
  const mine = memberships.map((m) => ({ siteId: m.siteId, creatorId, role: m.role }));
  return docs.flatMap((doc) => {
    const site = fromDoc<Site>(doc);
    const role = roleIn(mine, site, creatorId);
    return role ? [{ site, role }] : [];
  });
}

/**
 * Resolves the site for an incoming host: `<slug>.<root>` first, then an active custom domain.
 * Port is ignored for custom domains so local test hosts like learn.foo.localhost:3000 work.
 */
export async function getSiteByHost(rawHost: string) {
  const host = rawHost.toLowerCase();
  const { sites } = await db();
  const suffix = `.${ROOT_DOMAIN}`;
  if (host.endsWith(suffix)) {
    const bySlug = await sites.findOne({ slug: host.slice(0, -suffix.length) });
    if (bySlug) return fromDoc<Site>(bySlug);
  }
  const doc = await sites.findOne({ "domain.hostname": stripPort(host), "domain.status": "active" });
  return doc ? fromDoc<Site>(doc) : null;
}

export async function createSite(input: { ownerId: string; slug: string; name: string; creatorName: string; template: TemplateId }) {
  const site: Site = {
    id: randomUUID(),
    ownerId: input.ownerId,
    slug: input.slug,
    name: input.name,
    headline: `Learn with *${input.creatorName.split(" ")[0]}*.`,
    bio: "Tell learners what you teach, who it's for and what they'll be able to do after.",
    creator: { name: input.creatorName, title: "Educator", rating: 5 },
    stats: { learners: 0, rating: 5, results: 0, resultsLabel: "results so far" },
    live: [],
    quotes: [],
    community: { title: `Join the ${input.name} community`, body: "Practice together, ask questions and get updates first.", cta: "Join free" },
    theme: { ...DEFAULT_THEME, sections: { stats: false, live: false, quotes: false, community: true } },
    createdAt: new Date().toISOString(),
  };
  // The chosen industry decides the starting page, the look and where the site shows up on Explore.
  const tpl = TEMPLATES.find((t) => t.id === input.template)!;
  site.theme = { ...DEFAULT_THEME, ...LOOKS[tpl.look].theme, custom: undefined };
  site.category = tpl.id;
  site.listed = true;
  site.blocks = starterBlocks(tpl.id, site);

  return withTransaction(async ({ c, session }) => {
    // A first-time teacher is named by what they typed, not guessed from their email address.
    const hasSite = await c.sites.countDocuments({ ownerId: input.ownerId }, { session, limit: 1 });
    if (!hasSite) await c.creators.updateOne({ _id: input.ownerId }, { $set: { name: input.creatorName } }, { session });
    try {
      await c.sites.insertOne(toDoc(site), { session });
    } catch (err) {
      if (isDuplicateKey(err)) throw new Error("That address is taken. Try another.");
      throw err;
    }
    return site;
  });
}

async function updateSite(filter: { slug: string } | { _id: string }, set: Partial<Site>, unset: (keyof Site)[] = []) {
  const doc = await (await db()).sites.findOneAndUpdate(
    filter,
    { $set: set, ...(unset.length ? { $unset: Object.fromEntries(unset.map((k) => [k, ""])) } : {}) },
    { returnDocument: "after" },
  );
  return doc ? fromDoc<Site>(doc) : null;
}

export async function saveBrand(slug: string, draft: BrandDraft) {
  const site = await updateSite({ slug }, { name: draft.name, headline: draft.headline, bio: draft.bio, theme: draft.theme });
  if (!site) throw new Error("Site not found");
  return site;
}

/** Publishes what the visual editor sends. Keeps the site's headline and intro in step with the first hero, for link previews. */
export async function saveSite(slug: string, draft: SiteDraft) {
  const set: Partial<Site> = { name: draft.name, theme: draft.theme, blocks: draft.blocks, chrome: draft.chrome, pages: draft.pages, courseTemplate: draft.courseTemplate };
  const hero = draft.blocks.find((b) => b.type === "hero" && !b.hidden);
  if (hero) {
    if (typeof hero.props.headline === "string" && hero.props.headline) set.headline = hero.props.headline;
    if (typeof hero.props.body === "string") set.bio = hero.props.body;
  }
  const site = await updateSite({ slug }, set);
  if (!site) throw new Error("Site not found");
  return site;
}

/** The unique index on domain.hostname is what stops two sites claiming one domain, even at the same moment. */
export async function setDomain(siteId: string, domain: CustomDomain | undefined) {
  try {
    const site = domain ? await updateSite({ _id: siteId }, { domain }) : await updateSite({ _id: siteId }, {}, ["domain"]);
    if (!site) throw new Error("Site not found");
  } catch (err) {
    if (isDuplicateKey(err)) throw new Error("Another Kalaa site already uses that domain.");
    throw err;
  }
}

/** Sites shown on Explore: opted in (the default) and with at least one published course. */
export async function listPublicSites() {
  const c = await db();
  const sites = await c.sites.find({ listed: { $ne: false } }).toArray();
  const courses = await c.courses.find({ siteId: { $in: sites.map((s) => s._id) }, published: true }).toArray();
  const bySite = Map.groupBy(courses.map((d) => fromDoc<Course>(d)), (course) => course.siteId);
  return sites.map((doc) => fromDoc<Site>(doc)).map((site) => ({ site, courses: bySite.get(site.id) ?? [] })).filter((x) => x.courses.length > 0);
}

export async function updateSettings(siteId: string, patch: { category?: string; listed: boolean; upiId?: string; payNote?: string }) {
  const set: Partial<Site> = { listed: patch.listed };
  const unset: (keyof Site)[] = [];
  if (patch.category) set.category = patch.category;
  if (patch.upiId) set.upiId = patch.upiId;
  else unset.push("upiId");
  if (patch.payNote) set.payNote = patch.payNote;
  else unset.push("payNote");
  return !!(await updateSite({ _id: siteId }, set, unset));
}
