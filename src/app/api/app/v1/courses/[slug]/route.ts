import { lessonKey } from "@/lib/lessons";
import { appLearner, appSite, fail, json } from "@/server/app-api";
import { getCourse, getProgress, learnerAccess } from "@/server/data";

// A course and its lessons. A lesson's link and files are included only when the learner may open it
// (paid for, or a free preview), the same rule the website applies, so locked material never leaves the server.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const site = await appSite();
  if (!site) return fail(404, "Unknown school.");
  const course = await getCourse(site.id, (await params).slug);
  if (!course) return fail(404, "Course not found.");
  const learner = await appLearner(site, req);
  const access = learner ? await learnerAccess(site.id, learner.email) : null;
  const paid = !!access?.paid.has(course.id);
  if (!course.published && !paid) return fail(404, "Course not found.");
  const progress = learner && paid ? await getProgress(site.id, learner.id, course.id) : { completed: new Set<string>(), lastLesson: "" };
  return json({
    ok: true,
    course: { id: course.id, slug: course.slug, title: course.title, summary: course.summary, priceInr: course.priceInr, mrpInr: course.mrpInr ?? null },
    access: paid ? "paid" : access?.pending.has(course.id) ? "pending" : "none",
    lastLesson: progress.lastLesson,
    lessons: course.lessons.map((l, i) => {
      const open = paid || l.free;
      return {
        number: i + 1,
        title: l.title,
        minutes: l.minutes,
        free: l.free,
        locked: !open,
        done: progress.completed.has(lessonKey(l.title)),
        ...(open ? { url: l.url ?? null, files: (l.files ?? []).map((f) => ({ id: f.id, name: f.name, size: f.size, type: f.type })) } : {}),
      };
    }),
  });
}
