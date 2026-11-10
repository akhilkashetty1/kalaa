import { lessonKey } from "@/lib/lessons";
import { appLearner, appSite, fail, json, readJson } from "@/server/app-api";
import { getCourse, learnerAccess, recordProgress } from "@/server/data";

// Body: { lesson: 1-based number, done?: boolean }. Without `done` it only records where the learner is.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const site = await appSite();
  if (!site) return fail(404, "Unknown school.");
  const learner = await appLearner(site, req);
  if (!learner) return fail(401, "Signed out.");
  const body = await readJson(req);
  const course = await getCourse(site.id, (await params).slug);
  const n = typeof body.lesson === "number" ? Math.trunc(body.lesson) : 0;
  const lesson = course?.lessons[n - 1];
  if (!course || !lesson) return fail(404, "Lesson not found.");
  if (!lesson.free && !(await learnerAccess(site.id, learner.email)).paid.has(course.id)) return fail(403, "This lesson is locked.");
  const done = typeof body.done === "boolean" ? body.done : undefined;
  const completed = await recordProgress({ siteId: site.id, learnerId: learner.id, courseId: course.id, lesson: lessonKey(lesson.title), complete: done });
  return json({ ok: true, completed });
}
