import "server-only";
import { db, progressId } from "@/server/db";

export { lessonKey } from "@/lib/lessons";

export async function getProgress(siteId: string, learnerId: string, courseId: string) {
  const p = await (await db()).progress.findOne({ _id: progressId(learnerId, courseId), siteId });
  return { completed: new Set(p?.completed ?? []), lastLesson: p?.lastLesson ?? "" };
}

/** Progress for every course a learner has started, keyed by course id. */
export async function getAllProgress(siteId: string, learnerId: string) {
  const docs = await (await db()).progress.find({ siteId, learnerId }).toArray();
  return new Map(docs.map((x) => [x.courseId, { completed: new Set(x.completed), lastLesson: x.lastLesson }]));
}

/** Records the lesson a learner is on, and marks it done or not done. Atomic updates, so two tabs can't overwrite each other. Returns how many lessons are done. */
export async function recordProgress(input: { siteId: string; learnerId: string; courseId: string; lesson: string; complete?: boolean }) {
  const { progress } = await db();
  const filter = { _id: progressId(input.learnerId, input.courseId) };
  const set = { lastLesson: input.lesson, updatedAt: new Date().toISOString() };
  const onInsert = { siteId: input.siteId, learnerId: input.learnerId, courseId: input.courseId };
  if (input.complete === true) {
    const doc = await progress.findOneAndUpdate(filter, { $set: set, $setOnInsert: onInsert, $addToSet: { completed: input.lesson } }, { upsert: true, returnDocument: "after" });
    return doc?.completed.length ?? 0;
  }
  const existing = await progress.findOneAndUpdate(filter, { $set: set, ...(input.complete === false ? { $pull: { completed: input.lesson } } : {}) }, { returnDocument: "after" });
  if (existing) return existing.completed.length;
  await progress.updateOne(filter, { $set: set, $setOnInsert: { ...onInsert, completed: [] } }, { upsert: true });
  return 0;
}

/** How many lessons each learner has finished, for the studio: keyed "email|courseId". */
export async function completedCounts(siteId: string) {
  const c = await db();
  const [learners, progress] = await Promise.all([c.learners.find({ siteId }, { projection: { email: 1 } }).toArray(), c.progress.find({ siteId }).toArray()]);
  const email = new Map(learners.map((l) => [l._id, l.email]));
  return new Map(progress.filter((p) => email.has(p.learnerId)).map((p) => [`${email.get(p.learnerId)}|${p.courseId}`, p.completed.length]));
}
