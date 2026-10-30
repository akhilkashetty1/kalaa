import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { inr, t } from "@/lib/i18n";
import { currentLearner } from "@/server/learner-auth";
import { getCourse, learnerAccess } from "@/server/data";
import { siteFromParam } from "@/server/tenant";
import { PayPanel } from "@/components/pay-panel";
import { ReserveForm } from "@/components/reserve-form";
import { reserveSeat } from "../../actions";

type Props = { params: Promise<{ site: string; course: string }> };

async function load(params: Props["params"]) {
  const p = await params;
  const site = await siteFromParam(p.site);
  const course = await getCourse(site.id, p.course);
  if (!course || !course.published) notFound();
  return { site, course, siteParam: p.site };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { course } = await load(params);
  return { title: course.title, description: course.summary };
}

export default async function CoursePage({ params }: Props) {
  const { site, course, siteParam } = await load(params);
  const s = t(site.theme.lang);
  const learner = await currentLearner(site.id);
  const access = learner ? await learnerAccess(site.id, learner.email) : null;
  const state = access?.paid.has(course.id) ? "paid" : access?.pending.has(course.id) ? "pending" : "open";
  const pay = site.upiId ? { upiId: site.upiId, note: site.payNote, payee: site.name, amount: course.priceInr, course: course.title } : undefined;
  const minutes = course.lessons.reduce((n, l) => n + l.minutes, 0);

  return (
    <main className="cp">
      <div>
        <a className="crumb" href="/#courses">← {s.back}</a>
        <h1>{course.title}</h1>
        <p className="lede">{course.summary}</p>
        <h2>{s.curriculum}</h2>
        <ol className="lessons">
          {course.lessons.map((l, i) => (
            <li key={i}>
              <span>
                {state === "paid" || l.free ? <a href={`/learn/${course.slug}?lesson=${i + 1}`}>{l.title}</a> : l.title}{" "}
                {l.free && <span className="tag">{s.free}</span>}
              </span>
              <small>{l.minutes} {s.min}</small>
            </li>
          ))}
        </ol>
        <p className="lede" style={{ fontSize: 14 }}>
          {course.lessons.length} {s.lessons} · {Math.round(minutes / 6) / 10}h · {site.creator.name}
        </p>
      </div>

      <aside className="buy">
        <div className="price num">
          {inr(course.priceInr)}
          {course.mrpInr && course.mrpInr > course.priceInr && <s>{inr(course.mrpInr)}</s>}
        </div>
        {state === "paid" ? (
          <div className="ok" role="status">
            <b>{s.enrolled}</b>
            <p>{s.enrolledSub}</p>
            <p style={{ marginTop: 12 }}><a className="bbtn" href={`/learn/${course.slug}`}>{s.openCourse} →</a></p>
          </div>
        ) : state === "pending" ? (
          <div className="ok" role="status">
            <b>{s.awaiting}</b>
            <p>{s.awaitingSub}</p>
            {pay && <div style={{ marginTop: 14 }}><PayPanel pay={pay} s={s} /></div>}
          </div>
        ) : (
          <>
            <ReserveForm action={reserveSeat.bind(null, siteParam, course.slug)} s={s} price={inr(course.priceInr)} learner={learner ? { name: learner.name, email: learner.email } : undefined} pay={pay} />
            {!learner && <p className="signin-hint">{s.alreadyEnrolled} <a href={`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`}>{s.signIn}</a></p>}
          </>
        )}
      </aside>
    </main>
  );
}
