import { redirect } from "next/navigation";
import { LearnerSignOut } from "@/components/learner-signout";
import { CourseCover } from "@/components/storefront";
import { t } from "@/lib/i18n";
import { currentLearner } from "@/server/learner-auth";
import { getAllProgress, learnerAccess, lessonKey, listCourses } from "@/server/data";
import { siteFromParam } from "@/server/tenant";

export const metadata = { title: "My courses", robots: { index: false } };

export default async function MyCourses({ params }: { params: Promise<{ site: string }> }) {
  const site = await siteFromParam((await params).site);
  const learner = await currentLearner(site.id);
  if (!learner) redirect("/login?next=/my-courses");
  const s = t(site.theme.lang);

  // All courses, published or not: someone who paid keeps access after a creator stops selling it.
  const [courses, access, progress] = await Promise.all([listCourses(site.id), learnerAccess(site.id, learner.email), getAllProgress(site.id, learner.id)]);
  const mine = courses.filter((c) => access.paid.has(c.id));
  const waiting = courses.filter((c) => access.pending.has(c.id) && !access.paid.has(c.id));

  return (
    <main className="lib">
      <div className="lib-head">
        <div>
          <h1>{s.libraryTitle}</h1>
          <p className="muted-line">{s.signedInAs} {learner.email}</p>
        </div>
        <LearnerSignOut label={s.signOut} />
      </div>

      {mine.length > 0 ? (
        <div className="courses">
          {mine.map((c, i) => {
            const p = progress.get(c.id);
            const done = c.lessons.filter((l) => p?.completed.has(lessonKey(l.title))).length;
            const resumeAt = p?.lastLesson ? c.lessons.findIndex((l) => lessonKey(l.title) === p.lastLesson) + 1 : 0;
            return (
            <article className="course" key={c.id}>
              <CourseCover index={i} tag={c.published ? c.tag : undefined} />
              <div className="bd">
                <h3>{c.title}</h3>
                <small>{done} {s.progressOf} {c.lessons.length} {s.lessonsDone}</small>
                <div className="lp-prog slim" aria-hidden="true"><span style={{ width: `${(done / Math.max(1, c.lessons.length)) * 100}%` }} /></div>
                <div className="pr"><span /><a className="bbtn sm" href={resumeAt > 0 ? `/learn/${c.slug}?lesson=${resumeAt}` : `/learn/${c.slug}`}>{done > 0 || resumeAt > 0 ? s.resume : s.startCourse} →</a></div>
              </div>
            </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-lib">
          <p>{s.libraryEmpty}</p>
          <a className="bbtn" href="/#courses">{s.browse}</a>
        </div>
      )}

      {waiting.length > 0 && (
        <section className="lib-wait">
          <h2>{s.waitingTitle}</h2>
          <p className="muted-line">{s.waitingSub}</p>
          <ul>
            {waiting.map((c) => (
              <li key={c.id}><a href={`/courses/${c.slug}`}>{c.title}</a></li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
