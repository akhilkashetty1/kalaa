"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AccessError, assertSiteAccess, currentCreator } from "@/server/auth";
import { RESERVED_SLUGS } from "@/lib/config";
import { normalizeHostname, releaseDomain, verifyDomain as checkDomain } from "@/server/domains";
import * as repo from "@/server/data";
import { AnnounceError, sendAnnouncement } from "@/server/announce";
import { removeFiles } from "@/server/files";
import { lessonsFromRows, parseLessons } from "@/lib/lessons";
import { sendAccessMail } from "@/server/learner-mail";
import type { Permission } from "@/lib/roles";
import { sanitizeTheme } from "@/lib/theme";
import { siteOrigin } from "@/server/tenant";
import { sanitizeBlocks } from "@/lib/blocks";
import { PublishError, applySnapshot, buildSnapshot, cancelSchedule, scheduleSnapshot } from "@/server/publish";
import { isTemplateId } from "@/lib/templates";
import type { BrandDraft, SiteDraft } from "@/lib/types";

// Every action re-checks the session and the caller's role: server actions are public endpoints,
// so the page that rendered the form proves nothing about who is calling.

export type FormState = { error?: string; ok?: string };

async function siteFor(slug: string, permission: Permission) {
  return (await assertSiteAccess(slug, permission)).site;
}

/** Forms show a denied action as a message; plain buttons let it throw. */
function denied(err: unknown): FormState {
  if (err instanceof AccessError) return { error: err.message };
  throw err;
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export async function createSite(_: FormState, formData: FormData): Promise<FormState> {
  const creator = await currentCreator();
  if (!creator) return { error: "Your session ended. Sign in again." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const creatorName = String(formData.get("creator") ?? "").trim().slice(0, 60);
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const industry = formData.get("industry");
  if (!isTemplateId(industry)) return { error: "Choose what kind of teaching you do." };
  if (!name) return { error: "Give your brand a name." };
  if (!creatorName) return { error: "Add the teacher's name learners will see." };
  if (!SLUG.test(slug)) return { error: "Use 3–32 lowercase letters, numbers or hyphens for the address." };
  if (RESERVED_SLUGS.has(slug)) return { error: "That address is reserved. Try another." };
  try {
    await repo.createSite({ ownerId: creator.id, slug, name, creatorName, template: industry });
  } catch (err) {
    return { error: (err as Error).message };
  }
  redirect(`/studio/${slug}`);
}

export async function saveBrand(slug: string, draft: BrandDraft): Promise<FormState> {
  const name = String(draft.name ?? "").trim().slice(0, 60);
  const headline = String(draft.headline ?? "").trim().slice(0, 120);
  const bio = String(draft.bio ?? "").trim().slice(0, 400);
  if (!name) return { error: "Your brand needs a name." };
  if (!headline) return { error: "Add a headline for your home page." };
  try {
    await siteFor(slug, "brand.manage");
  } catch (err) {
    return denied(err);
  }
  await repo.saveBrand(slug, { name, headline, bio, theme: sanitizeTheme(draft.theme) });
  revalidatePath(`/studio/${slug}`, "layout");
  return { ok: "Published" };
}

/** Publishes the visual editor's page and design. Everything is validated again here: the browser is not trusted. */
export async function publishSite(slug: string, draft: SiteDraft): Promise<FormState> {
  let ctx;
  try {
    ctx = await assertSiteAccess(slug, "brand.manage");
  } catch (err) {
    return denied(err);
  }
  try {
    await applySnapshot(ctx.site, await buildSnapshot(ctx.site, draft), ctx.creator.email);
  } catch (err) {
    if (err instanceof PublishError) return { error: err.message };
    throw err;
  }
  return { ok: "Published" };
}

/** Holds the editor's draft to be published at `at` (an ISO time). The draft is validated now, so a later publish can't surprise anyone. */
export async function schedulePublish(slug: string, draft: SiteDraft, at: string): Promise<FormState> {
  let ctx;
  try {
    ctx = await assertSiteAccess(slug, "brand.manage");
  } catch (err) {
    return denied(err);
  }
  try {
    await scheduleSnapshot(ctx.site, await buildSnapshot(ctx.site, draft), new Date(at), ctx.creator.email);
  } catch (err) {
    if (err instanceof PublishError) return { error: err.message };
    throw err;
  }
  return { ok: "Scheduled" };
}

export async function cancelScheduledPublish(slug: string, id: string): Promise<FormState> {
  try {
    const { site } = await assertSiteAccess(slug, "brand.manage");
    return (await cancelSchedule(site.id, id)) ? { ok: "Cancelled" } : { error: "That schedule no longer exists." };
  } catch (err) {
    return denied(err);
  }
}

const num = (v: FormDataEntryValue | null) => Math.round(Number(v));

/** Reads and validates the course form; shared by create and edit. */
async function readCourse(formData: FormData, siteId: string): Promise<{ fields: repo.CourseFields } | { error: string }> {
  const title = String(formData.get("title") ?? "").trim().slice(0, 100);
  const summary = String(formData.get("summary") ?? "").trim().slice(0, 300);
  const priceInr = num(formData.get("price"));
  const mrpRaw = String(formData.get("mrp") ?? "").trim();
  const mrpInr = mrpRaw ? num(mrpRaw) : undefined;
  const tag = String(formData.get("tag") ?? "").trim().slice(0, 24) || undefined;
  const seatsRaw = String(formData.get("seats") ?? "").trim();
  const seats = seatsRaw ? num(seatsRaw) : undefined;
  // The lesson editor sends JSON. Plain "title | minutes | free | link" lines are still understood.
  const rawLessons = String(formData.get("lessons") ?? "");
  let json: unknown;
  try { json = JSON.parse(rawLessons); } catch { json = undefined; }
  const parsed = Array.isArray(json) ? lessonsFromRows(json, await repo.siteFiles(siteId)) : parseLessons(rawLessons);

  if (!title) return { error: "Add a course title." };
  if (!Number.isFinite(priceInr) || priceInr < 0 || priceInr > 1_000_000) return { error: "Enter a price between ₹0 and ₹10,00,000." };
  if (mrpInr !== undefined && (!Number.isFinite(mrpInr) || mrpInr < priceInr)) return { error: "The original price should be higher than the selling price." };
  if (seats !== undefined && (!Number.isFinite(seats) || seats < 1 || seats > 10_000)) return { error: "Seats should be a number between 1 and 10,000, or left empty." };
  if ("error" in parsed) return { error: parsed.error };
  if (!parsed.lessons.length) return { error: "Add at least one lesson." };
  return { fields: { title, summary, priceInr, mrpInr, tag, seats, lessons: parsed.lessons } };
}

export async function createCourse(slug: string, _: FormState, formData: FormData): Promise<FormState> {
  let site;
  try {
    site = await siteFor(slug, "courses.manage");
  } catch (err) {
    return denied(err);
  }
  const read = await readCourse(formData, site.id);
  if ("error" in read) return read;
  await repo.createCourse(site.id, read.fields);
  revalidatePath(`/studio/${slug}`, "layout");
  return { ok: `“${read.fields.title}” saved as a draft. Publish it when you're ready.` };
}

export async function updateCourse(slug: string, courseId: string, _: FormState, formData: FormData): Promise<FormState> {
  let site;
  try {
    site = await siteFor(slug, "courses.manage");
  } catch (err) {
    return denied(err);
  }
  const read = await readCourse(formData, site.id);
  if ("error" in read) return read;
  const saved = await repo.updateCourse(site.id, courseId, read.fields);
  if (!saved.ok) return { error: "That course no longer exists." };
  await removeFiles(site.id, saved.removed); // files taken off lessons are deleted from disk
  revalidatePath(`/studio/${slug}`, "layout");
  return { ok: "Saved. Learners see the changes straight away." };
}

export async function toggleCourse(slug: string, courseId: string, published: boolean) {
  const site = await siteFor(slug, "courses.manage");
  await repo.setCoursePublished(site.id, courseId, published);
  revalidatePath(`/studio/${slug}`, "layout");
}

export async function deleteCourse(slug: string, courseId: string): Promise<FormState> {
  let ctx;
  try {
    ctx = await assertSiteAccess(slug, "courses.manage");
  } catch (err) {
    return denied(err);
  }
  const res = await repo.deleteCourse(ctx.site.id, courseId, ctx.creator);
  if (res.removed?.length) await removeFiles(ctx.site.id, res.removed);
  revalidatePath(`/studio/${slug}`, "layout");
  return res.error ? { error: res.error } : {};
}

/** Confirming payment is what gives a learner access to the course, so it needs its own permission. */
export async function setEnrollmentPaid(slug: string, enrollmentId: string, paid: boolean): Promise<FormState> {
  let ctx;
  try {
    ctx = await assertSiteAccess(slug, "payments.confirm");
  } catch (err) {
    return denied(err);
  }
  const res = await repo.setEnrollmentPaid({ siteId: ctx.site.id, enrollmentId, paid, actor: ctx.creator });
  if (!res.ok) return { error: res.error };
  revalidatePath(`/studio/${slug}`, "layout");
  if (paid && res.changed) {
    // The learner is told how to get in. A mail failure must not undo the confirmation.
    try {
      await sendAccessMail({ to: res.enrollment.email, name: res.enrollment.name, siteName: res.siteName, courseTitle: res.courseTitle, origin: siteOrigin(ctx.site) });
    } catch (err) {
      console.error(err);
      return { ok: "Marked as paid. We couldn't email the learner, so message them on WhatsApp." };
    }
  }
  return { ok: paid ? "Marked as paid. The learner has access." : "Access revoked." };
}

export async function addDomain(slug: string, _: FormState, formData: FormData): Promise<FormState> {
  let site;
  try {
    site = await siteFor(slug, "domain.manage");
  } catch (err) {
    return denied(err);
  }
  const parsed = normalizeHostname(String(formData.get("hostname") ?? ""));
  if ("error" in parsed) return { error: parsed.error };
  if (site.domain) await releaseDomain(site.domain);
  try {
    await repo.setDomain(site.id, { hostname: parsed.hostname, status: "pending", message: "Add the DNS record below, then verify." });
  } catch (err) {
    return { error: (err as Error).message };
  }
  revalidatePath(`/studio/${slug}`, "layout");
  return { ok: `${parsed.hostname} added.` };
}

export async function verifyDomain(slug: string) {
  const site = await siteFor(slug, "domain.manage");
  if (!site.domain) return;
  await repo.setDomain(site.id, await checkDomain(site.domain));
  revalidatePath(`/studio/${slug}`, "layout");
}

export async function removeDomain(slug: string) {
  const site = await siteFor(slug, "domain.manage");
  if (site.domain) await releaseDomain(site.domain);
  await repo.setDomain(site.id, undefined);
  revalidatePath(`/studio/${slug}`, "layout");
}

const UPI = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/;

/** How the site shows up on Explore and how students pay. Owner and co-owner only, since it points money at an account. */
export async function saveSettings(slug: string, _: FormState, formData: FormData): Promise<FormState> {
  let site;
  try {
    site = await siteFor(slug, "payments.confirm");
  } catch (err) {
    return denied(err);
  }
  const category = String(formData.get("category") ?? "");
  const upiId = String(formData.get("upiId") ?? "").trim();
  const payNote = String(formData.get("payNote") ?? "").trim().slice(0, 300);
  if (!isTemplateId(category)) return { error: "Choose the kind of teaching you do." };
  if (upiId && !UPI.test(upiId)) return { error: "That UPI ID doesn't look right. It should look like name@bank." };
  await repo.updateSettings(site.id, { category, listed: formData.get("listed") === "on", upiId, payNote });
  revalidatePath(`/studio/${slug}`, "layout");
  return { ok: "Saved." };
}

/** Emails the paid students of one course (or just the sender, as a test). Owner and co-owner only. */
export async function announceToStudents(slug: string, input: { courseId: string; subject: string; body: string; test: boolean }): Promise<FormState> {
  let ctx;
  try {
    ctx = await assertSiteAccess(slug, "students.message");
  } catch (err) {
    return denied(err);
  }
  try {
    const res = await sendAnnouncement({ site: ctx.site, courseId: String(input?.courseId ?? ""), subject: String(input?.subject ?? ""), body: String(input?.body ?? ""), sender: ctx.creator, test: input?.test === true });
    revalidatePath(`/studio/${slug}`, "layout");
    if (res.test) return res.failed ? { error: "The test email couldn't be sent. Check your email settings." } : { ok: `A test email was sent to ${ctx.creator.email}.` };
    return { ok: `Sent to ${res.sent} ${res.sent === 1 ? "student" : "students"}.${res.failed ? ` ${res.failed} couldn't be delivered.` : ""}` };
  } catch (err) {
    if (err instanceof AnnounceError) return { error: err.message };
    throw err;
  }
}
