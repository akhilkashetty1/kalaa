import "server-only";
import { randomUUID } from "node:crypto";
import type { Course, Creator, Lesson, LessonFile } from "@/lib/types";
import { recordAudit } from "@/server/audit";
import { db, fromDoc, isDuplicateKey, lockSite, toDoc, withTransaction, type Tx } from "@/server/db";

export async function listCourses(siteId: string, opts: { publishedOnly?: boolean } = {}) {
  const docs = await (await db()).courses.find({ siteId, ...(opts.publishedOnly ? { published: true } : {}) }).sort({ createdAt: 1 }).toArray();
  return docs.map((d) => fromDoc<Course>(d));
}

export async function getCourse(siteId: string, slug: string) {
  const doc = await (await db()).courses.findOne({ siteId, slug });
  return doc ? fromDoc<Course>(doc) : null;
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "course";
}

export type CourseFields = { title: string; summary: string; priceInr: number; mrpInr?: number; tag?: string; lessons: Lesson[] };

/** Picks the first free slug; the unique index settles a race between two courses with the same title. */
export async function createCourse(siteId: string, input: CourseFields) {
  const { courses } = await db();
  const base = slugify(input.title);
  const taken = new Set((await courses.find({ siteId, slug: { $regex: `^${base}(-\\d+)?$` } }, { projection: { slug: 1 } }).toArray()).map((c) => c.slug));
  for (let attempt = 0; attempt < 5; attempt++) {
    let slug = base;
    for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
    const course: Course = { ...input, id: randomUUID(), siteId, slug, published: false, createdAt: new Date().toISOString() };
    try {
      await courses.insertOne(toDoc(course));
      return course;
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      taken.add(slug);
    }
  }
  throw new Error("Couldn't pick an address for this course. Try a different title.");
}

export async function setCoursePublished(siteId: string, courseId: string, published: boolean) {
  await (await db()).courses.updateOne({ _id: courseId, siteId }, { $set: { published } });
}

/** File ids still used by any lesson in the site, so shared files are never deleted from under a lesson. */
async function usedFileIds({ c, session }: Tx, siteId: string) {
  return new Set((await c.courses.distinct("lessons.files.id", { siteId }, { session })) as string[]);
}

/** The site's uploaded files, by id. Course saves use it to accept only files that really belong to the site. */
export async function siteFiles(siteId: string) {
  const docs = await (await db()).files.find({ siteId }, { projection: { name: 1, size: 1, type: 1 } }).toArray();
  return new Map<string, LessonFile>(docs.map((f) => [f._id, { id: f._id, name: f.name, size: f.size, type: f.type }]));
}

/** Drops the records of files no lesson uses any more, and returns their ids so the caller can delete the bytes. */
async function releaseFiles(tx: Tx, siteId: string, candidates: string[]) {
  const used = await usedFileIds(tx, siteId);
  const removed = [...new Set(candidates)].filter((id) => !used.has(id));
  if (removed.length) await tx.c.files.deleteMany({ _id: { $in: removed }, siteId }, { session: tx.session });
  return removed;
}

const fileIdsOf = (lessons: Lesson[]) => lessons.flatMap((l) => (l.files ?? []).map((f) => f.id));

/** Saves a course. `removed` lists files that were attached before and are now unused, to be deleted from storage. */
export async function updateCourse(siteId: string, courseId: string, fields: CourseFields): Promise<{ ok: boolean; removed: string[] }> {
  return withTransaction(async (tx) => {
    const { c, session } = tx;
    const before = await c.courses.findOne({ _id: courseId, siteId }, { session, projection: { lessons: 1 } });
    if (!before) return { ok: false, removed: [] };
    const unset: Partial<Record<"mrpInr" | "tag", "">> = {};
    if (fields.mrpInr === undefined) unset.mrpInr = "";
    if (fields.tag === undefined) unset.tag = "";
    await c.courses.updateOne(
      { _id: courseId, siteId },
      { $set: { title: fields.title, summary: fields.summary, priceInr: fields.priceInr, lessons: fields.lessons, mrpInr: fields.mrpInr, tag: fields.tag }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { session },
    );
    return { ok: true, removed: await releaseFiles(tx, siteId, fileIdsOf(before.lessons)) };
  });
}

/** Refuses while anyone has paid for the course: deleting it would take away something they bought. */
export async function deleteCourse(siteId: string, courseId: string, actor: Creator): Promise<{ error?: string; removed?: string[] }> {
  return withTransaction(async (tx) => {
    const { c, session } = tx;
    await lockSite(tx, siteId); // a payment confirmed at the same moment can't slip past the check below
    const course = await c.courses.findOne({ _id: courseId, siteId }, { session });
    if (!course) return {};
    const paid = await c.enrollments.countDocuments({ courseId, status: "paid" }, { session });
    if (paid > 0) return { error: `${paid} ${paid === 1 ? "learner has" : "learners have"} paid for this course. Unpublish it instead. They keep their access.` };
    await c.courses.deleteOne({ _id: courseId }, { session });
    const removed = await releaseFiles(tx, siteId, fileIdsOf(course.lessons));
    await recordAudit(tx, { id: siteId }, actor, "course_delete", `Deleted the course “${course.title}”`);
    return { removed };
  });
}
