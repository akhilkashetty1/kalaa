import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { blocksFor, sanitizeBlocks } from "@/lib/blocks";
import { chromeFor, sanitizeChrome } from "@/lib/chrome";
import { dropForeignMedia, mediaRefs } from "@/lib/media";
import { sanitizeCourseTemplate, sanitizePages } from "@/lib/pages";
import { sanitizeTheme } from "@/lib/theme";
import type { ScheduledPublish, Site, SiteSnapshot, SiteVersion } from "@/lib/types";
import { db, fromDoc, toDoc } from "@/server/db";
import { saveSite } from "@/server/data/sites";
import { UserError } from "@/server/errors";
import { ownedMediaIds } from "@/server/media";

// Publishing, in one place. A draft from the editor is validated once (everything the browser sends is
// untrusted), becomes a snapshot, and a snapshot is what gets published now, kept as a version, or held
// for later. Manual publishes, scheduled ones and the cron job all use the same functions.

export class PublishError extends UserError {}

export const MAX_VERSIONS = 30;
export const MAX_PENDING_SCHEDULES = 5;

/** Validates a draft and returns the snapshot to publish. Images must come from the site's own library. */
export async function buildSnapshot(site: Site, draft: unknown): Promise<SiteSnapshot> {
  const d = (draft && typeof draft === "object" ? draft : {}) as Record<string, unknown>;
  const name = String(d.name ?? "").trim().slice(0, 60);
  if (!name) throw new PublishError("Your site needs a name.");
  const blocks = sanitizeBlocks(d.blocks);
  if (!blocks.some((b) => !b.hidden)) throw new PublishError("Keep at least one visible section on the page.");
  const parts = { blocks, chrome: sanitizeChrome(d.chrome), pages: sanitizePages(d.pages), courseTemplate: sanitizeCourseTemplate(d.courseTemplate) };
  const owned = await ownedMediaIds(site.id, mediaRefs(parts));
  return { name, theme: sanitizeTheme(d.theme), ...dropForeignMedia(parts, owned) };
}

/** What the site shows right now, as a snapshot. */
export const snapshotOf = (site: Site): SiteSnapshot => ({ name: site.name, theme: site.theme, blocks: blocksFor(site), chrome: chromeFor(site), pages: site.pages ?? [], courseTemplate: sanitizeCourseTemplate(site.courseTemplate) });

async function recordVersion(siteId: string, snapshot: SiteSnapshot, by: string, label: string) {
  const c = await db();
  const version: SiteVersion = { id: randomUUID(), siteId, createdAt: new Date().toISOString(), by, label, snapshot };
  await c.siteVersions.insertOne(toDoc(version));
  const old = await c.siteVersions.find({ siteId }, { projection: { _id: 1 } }).sort({ createdAt: -1 }).skip(MAX_VERSIONS).toArray();
  if (old.length) await c.siteVersions.deleteMany({ _id: { $in: old.map((v) => v._id) } });
}

/** Publishes a snapshot: it becomes the live site and is kept as a version. The first time, what was live before is kept too. */
export async function applySnapshot(site: Site, snapshot: SiteSnapshot, by: string, label = "Published") {
  const c = await db();
  if ((await c.siteVersions.countDocuments({ siteId: site.id }, { limit: 1 })) === 0) await recordVersion(site.id, snapshotOf(site), "—", "Before your first saved version");
  await saveSite(site.slug, snapshot);
  await recordVersion(site.id, snapshot, by, label);
  try {
    revalidatePath(`/studio/${site.slug}`, "layout");
  } catch {
    /* only a cache hint: not available outside a Next request, such as in scripts */
  }
}

// ---- versions ----

export async function listVersions(siteId: string) {
  const docs = await (await db()).siteVersions.find({ siteId }, { projection: { snapshot: 0 } }).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => ({ id: d._id, createdAt: d.createdAt, by: d.by, label: d.label }));
}

export async function getVersion(siteId: string, id: string) {
  const doc = await (await db()).siteVersions.findOne({ _id: id, siteId });
  return doc ? fromDoc<SiteVersion>(doc) : null;
}

// ---- scheduled publishing ----

export async function scheduleSnapshot(site: Site, snapshot: SiteSnapshot, at: Date, by: string) {
  const now = Date.now();
  if (Number.isNaN(at.getTime()) || at.getTime() < now + 2 * 60 * 1000) throw new PublishError("Pick a time at least a few minutes from now.");
  if (at.getTime() > now + 90 * 24 * 60 * 60 * 1000) throw new PublishError("You can schedule up to 90 days ahead.");
  const c = await db();
  if ((await c.scheduledPublishes.countDocuments({ siteId: site.id, status: "pending" })) >= MAX_PENDING_SCHEDULES) throw new PublishError(`You can have ${MAX_PENDING_SCHEDULES} scheduled publishes at a time. Cancel one first.`);
  const item: ScheduledPublish = { id: randomUUID(), siteId: site.id, at: at.toISOString(), by, status: "pending", createdAt: new Date().toISOString(), snapshot };
  await c.scheduledPublishes.insertOne(toDoc(item));
  return item.id;
}

export async function listSchedules(siteId: string) {
  const docs = await (await db()).scheduledPublishes.find({ siteId, status: { $in: ["pending", "failed"] } }, { projection: { snapshot: 0 } }).sort({ at: 1 }).toArray();
  return docs.map((d) => ({ id: d._id, at: d.at, by: d.by, status: d.status, error: d.error }));
}

export async function cancelSchedule(siteId: string, id: string) {
  return ((await (await db()).scheduledPublishes.deleteOne({ _id: id, siteId, status: { $in: ["pending", "failed"] } })).deletedCount ?? 0) > 0;
}

/**
 * Publishes every schedule that is due (for one site, or all of them). Each is claimed atomically first, so
 * two callers at the same moment never publish it twice. Returns how many went live.
 */
export async function applyDueSchedules(siteId?: string): Promise<number> {
  const c = await db();
  let applied = 0;
  for (let i = 0; i < 20; i++) {
    const claimed = await c.scheduledPublishes.findOneAndUpdate(
      { status: "pending", at: { $lte: new Date().toISOString() }, ...(siteId ? { siteId } : {}) },
      { $set: { status: "running" } },
      { sort: { at: 1 }, returnDocument: "after" },
    );
    if (!claimed) break;
    const job = fromDoc<ScheduledPublish>(claimed);
    try {
      const siteDoc = await c.sites.findOne({ _id: job.siteId });
      if (!siteDoc) throw new PublishError("The site no longer exists.");
      await applySnapshot(fromDoc<Site>(siteDoc), job.snapshot, job.by, "Scheduled publish");
      await c.scheduledPublishes.deleteOne({ _id: job.id });
      applied++;
    } catch (err) {
      console.error("[kalaa publish] scheduled publish failed", job.id, err);
      await c.scheduledPublishes.updateOne({ _id: job.id }, { $set: { status: "failed", error: err instanceof Error ? err.message.slice(0, 200) : "Publish failed." } });
    }
  }
  return applied;
}
