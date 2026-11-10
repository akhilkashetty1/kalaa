import { appLearner, appSite, fail, json } from "@/server/app-api";
import { getAllProgress, learnerAccess, listCourses } from "@/server/data";

// The signed-in learner's library: courses they have paid for, with progress, and the ones awaiting payment.
export async function GET(req: Request) {
  const site = await appSite();
  if (!site) return fail(404, "Unknown school.");
  const learner = await appLearner(site, req);
  if (!learner) return fail(401, "Signed out.");
  const [access, progress, courses] = await Promise.all([learnerAccess(site.id, learner.email), getAllProgress(site.id, learner.id), listCourses(site.id)]);
  const row = (c: (typeof courses)[number]) => ({ id: c.id, slug: c.slug, title: c.title, summary: c.summary, lessons: c.lessons.length, done: progress.get(c.id)?.completed.size ?? 0 });
  return json({
    ok: true,
    learner: { id: learner.id, name: learner.name, email: learner.email },
    courses: courses.filter((c) => access.paid.has(c.id)).map(row),
    pending: courses.filter((c) => c.published && access.pending.has(c.id) && !access.paid.has(c.id)).map(({ id, slug, title }) => ({ id, slug, title })),
  });

}
