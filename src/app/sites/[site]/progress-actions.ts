"use server";

import { currentLearner } from "@/server/learner-auth";
import { getCourse, learnerAccess, lessonKey, recordProgress } from "@/server/data";
import { siteFromHost } from "@/server/tenant";

// A learner's lesson progress. The site comes from the Host header and the learner from their session;
// the lesson must exist and be one they may open (paid for, or a free preview).

async function context(courseSlug: string, lessonIndex: number) {
  const site = await siteFromHost();
  const learner = await currentLearner(site.id);
  if (!learner) return null;
  const course = await getCourse(site.id, courseSlug);
  const lesson = course?.lessons[Math.trunc(lessonIndex) - 1];
  if (!course || !lesson) return null;
  const access = await learnerAccess(site.id, learner.email);
  if (!lesson.free && !access.paid.has(course.id)) return null;
  return { site, learner, course, lesson };
}

/** Remembers where the learner is, so My courses can offer "continue". */
export async function visitLesson(courseSlug: string, lessonIndex: number): Promise<void> {
  const c = await context(courseSlug, lessonIndex);
  if (c) await recordProgress({ siteId: c.site.id, learnerId: c.learner.id, courseId: c.course.id, lesson: lessonKey(c.lesson.title) });
}

export async function setLessonComplete(courseSlug: string, lessonIndex: number, done: boolean): Promise<{ ok: boolean }> {
  const c = await context(courseSlug, lessonIndex);
  if (!c) return { ok: false };
  await recordProgress({ siteId: c.site.id, learnerId: c.learner.id, courseId: c.course.id, lesson: lessonKey(c.lesson.title), complete: done });
  return { ok: true };
}
