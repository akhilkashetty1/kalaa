import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { t } from "@/lib/i18n";
import { currentLearner } from "@/server/learner-auth";
import { embedFor, formatBytes } from "@/lib/lessons";
import { LessonControls } from "@/components/lesson-controls";
import { getCourse, getProgress, learnerAccess, lessonKey } from "@/server/data";
import { siteFromParam } from "@/server/tenant";

type Props = { params: Promise<{ site: string; course: string }>; searchParams: Promise<{ lesson?: string }> };

export const metadata: Metadata = { robots: { index: false } };

export default async function LearnPage({ params, searchParams }: Props) {
  const p = await params;
  const site = await siteFromParam(p.site);
  const course = await getCourse(site.id, p.course);
  if (!course) notFound();

  const learner = await currentLearner(site.id);
  const access = learner ? await learnerAccess(site.id, learner.email) : null;
  const paid = !!access?.paid.has(course.id);
  const pending = !!access?.pending.has(course.id);
  // An unpublished course is only visible to people who already paid for it.
  if (!course.published && !paid) notFound();

  const s = t(site.theme.lang);
  const progress = learner && paid ? await getProgress(site.id, learner.id, course.id) : { completed: new Set<string>(), lastLesson: "" };
  const doneCount = course.lessons.filter((l) => progress.completed.has(lessonKey(l.title))).length;
  const requested = Number.parseInt((await searchParams).lesson ?? "1", 10);
  const n = course.lessons.length;
  const index = Number.isFinite(requested) && requested >= 1 && requested <= n ? requested : 1;
  const lesson = course.lessons[index - 1];
  const unlocked = paid || lesson.free;
  const here = `/learn/${course.slug}?lesson=${index}`;

  // The lesson link is read only after the check above, so a locked lesson's material is never sent to the browser.
  const material = unlocked ? lesson.url : undefined;
  const embed = material ? embedFor(material) : null;

  return (
    <main className="lp">
      <div className="lp-top">
        <a className="crumb" href={paid ? "/my-courses" : `/courses/${course.slug}`}>← {paid ? s.myCourses : s.back}</a>
        <h1>{course.title}</h1>
        {!course.published && paid && <p className="muted-line">{s.unpublishedNote}</p>}
        {paid && (
          <div className="lp-prog" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={doneCount} aria-label={s.lessonsDone}>
            <span style={{ width: `${(doneCount / n) * 100}%` }} />
            <small>{doneCount} {s.progressOf} {n} {s.lessonsDone}</small>
          </div>
        )}
      </div>

      <div className="lp-grid">
        <section className="lp-main">
          <div className="lp-stage">
            {!unlocked ? (
              <div className="lp-lock">
                <b>{s.lockedTitle}</b>
                <p>{s.lockedBody}</p>
                <div className="lp-cta">
                  {pending ? <span className="muted-line">{s.awaitingSub}</span> : <a className="bbtn" href={`/courses/${course.slug}`}>{s.reserve}</a>}
                  {!learner && <a className="bbtn ghost" href={`/login?next=${encodeURIComponent(here)}`}>{s.signIn}</a>}
                </div>
              </div>
            ) : embed ? (
              <iframe
                src={embed}
                title={lesson.title}
                allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
              />
            ) : material ? (
              <div className="lp-lock">
                <b>{lesson.title}</b>
                <div className="lp-cta"><a className="bbtn" href={material} target="_blank" rel="noopener noreferrer">{s.openMaterial} ↗</a></div>
              </div>
            ) : (
              <div className="lp-lock"><p>{s.noVideo}</p></div>
            )}
          </div>

          <div className="lp-meta">
            <div>
              <small>{s.lessonOf} {index} / {n}</small>
              <h2>{lesson.title}</h2>
            </div>
            <div className="lp-nav">
              <LessonControls course={course.slug} index={index} total={n} signedIn={!!learner && unlocked} done={progress.completed.has(lessonKey(lesson.title))} labels={{ complete: s.markComplete, completed: s.completed, completeNext: s.completeNext, finish: s.finishCourse }} />
              {index > 1 && <a className="bbtn ghost sm" href={`/learn/${course.slug}?lesson=${index - 1}`}>← {s.previous}</a>}
              {index < n && <a className="bbtn sm" href={`/learn/${course.slug}?lesson=${index + 1}`}>{s.next} →</a>}
            </div>
          </div>
          {unlocked && !!lesson.files?.length && (
            <div className="lp-files">
              <h3>{s.materials}</h3>
              <ul>
                {lesson.files.map((f) => (
                  <li key={f.id}>
                    <a href={`/files/${f.id}`} target="_blank" rel="noopener">
                      <span aria-hidden="true">📎</span>
                      <b>{f.name}</b>
                      <small>{formatBytes(f.size)}</small>
                      <em>{f.type === "application/pdf" ? s.openFile : s.downloadFile}</em>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="lp-list" aria-label={s.curriculum}>
          <ol>
            {course.lessons.map((l, i) => {
              const open = paid || l.free;
              return (
                <li key={i} aria-current={i + 1 === index ? "true" : undefined} className={`${open ? "" : "locked"}${progress.completed.has(lessonKey(l.title)) ? " done" : ""}`.trim()}>
                  <a href={`/learn/${course.slug}?lesson=${i + 1}`}>
                    <span className="n">{progress.completed.has(lessonKey(l.title)) ? "✓" : i + 1}</span>
                    <span className="t">{l.title}</span>
                    <small>{open ? `${l.files?.length ? "📎 " : ""}${l.free && !paid ? s.free : `${l.minutes} ${s.min}`}` : "🔒"}</small>
                  </a>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </main>
  );
}
