import Link from "next/link";
import { requireSiteAccess } from "@/server/auth";
import { ROLE_META, can } from "@/lib/roles";
import { teamOf } from "@/server/team";
import { siteOrigin } from "@/server/tenant";
import { inr } from "@/lib/i18n";
import { listCourses, listEnrollments } from "@/server/data";
import { publicHost } from "@/server/tenant";

const STATUS = {
  active: { cls: "ok", label: "Live" },
  issuing: { cls: "wait", label: "Issuing SSL" },
  pending: { cls: "wait", label: "Needs DNS" },
  error: { cls: "bad", label: "Check DNS" },
} as const;

export default async function Overview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site, role } = await requireSiteAccess(slug);
  const seeReservations = can(role, "reservations.view");
  const [courses, allEnrollments, { members }] = await Promise.all([listCourses(site.id), listEnrollments(site.id), teamOf(site)]);
  const enrollments = seeReservations ? allEnrollments : [];
  const published = courses.filter((c) => c.published);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const paidOnes = enrollments.filter((e) => e.status === "paid");
  const waiting = enrollments.filter((e) => e.status !== "paid");
  const valueOf = (list: typeof enrollments) => list.reduce((n, e) => n + (byId.get(e.courseId)?.priceInr ?? 0), 0);
  const domain = site.domain ? STATUS[site.domain.status] : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="ws-head">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</div>
          <h1>{greeting}, {site.creator.name.split(" ")[0]}</h1>
        </div>
        <div className="row"><span className="pill ok"><span className="dot" />{publicHost(site)}</span></div>
      </div>

      {(() => {
        const manage = can(role, "courses.manage");
        const steps = [
          { done: courses.length > 0, label: "Add your first course", hint: "Give it a title, a price and a few lessons.", href: `/studio/${slug}/courses`, show: manage },
          { done: courses.some((c) => c.lessons.some((l) => l.url)), label: "Add video links to your lessons", hint: "YouTube or Vimeo links play inside your page. Use unlisted videos.", href: `/studio/${slug}/courses`, show: manage },
          { done: published.length > 0, label: "Publish a course", hint: "Published courses appear on your site.", href: `/studio/${slug}/courses`, show: manage },
          { done: !!site.upiId, label: "Tell students how to pay you", hint: "Add your UPI ID so they can pay in one tap.", href: `/studio/${slug}/settings`, show: can(role, "payments.confirm") },
          { done: members.length > 1, label: "Invite a teammate", hint: "An editor or support person, if you have one.", href: `/studio/${slug}/team`, show: can(role, "team.manage") },
        ].filter((x) => x.show);
        const left = steps.filter((x) => !x.done);
        if (!steps.length) return null;
        return (
          <div className="panel check">
            <div className="card-h"><h2>{left.length ? `Get set up: ${steps.length - left.length} of ${steps.length} done` : "You're set up"}</h2><a className="btn sm" href={siteOrigin(site)} target="_blank" rel="noopener">Open your site ↗</a></div>
            <div className="check-bar"><i style={{ width: `${((steps.length - left.length) / steps.length) * 100}%` }} /></div>
            <ul>
              {steps.map((st) => (
                <li key={st.label} className={st.done ? "done" : ""}>
                  <span aria-hidden="true">{st.done ? "✓" : "○"}</span>
                  <div><b>{st.label}</b>{!st.done && <small>{st.hint}</small>}</div>
                  {!st.done && <Link className="btn sm" href={st.href}>Do this →</Link>}
                </li>
              ))}
            </ul>
            <p className="hint" style={{ padding: "4px 18px 16px" }}>Your site address: <code>{siteOrigin(site)}</code>. Want a different look? <Link href={`/editor/${slug}`} style={{ color: "var(--gold)" }}>Open the site editor</Link>.</p>
          </div>
        );
      })()}

      <div className="kpis">
        <div className="panel kpi"><span>Published courses</span><b className="num">{published.length}</b><em>{courses.length - published.length} in draft</em></div>
        {seeReservations && (
          <>
            <div className="panel kpi"><span>Paid enrollments</span><b className="num">{paidOnes.length}</b><em>{inr(valueOf(paidOnes))} confirmed</em></div>
            <div className="panel kpi"><span>Awaiting payment</span><b className="num">{waiting.length}</b><em>{inr(valueOf(waiting))} if they pay</em></div>
          </>
        )}
        <div className="panel kpi">
          <span>Team</span>
          <b className="num">{members.length}</b>
          <em><Link href={`/studio/${slug}/team`}>You&apos;re {ROLE_META[role].label.toLowerCase()} →</Link></em>
        </div>
        <div className="panel kpi">
          <span>Custom domain</span>
          <b style={{ fontSize: 20, marginTop: 10 }}>{domain ? <span className={`pill ${domain.cls}`}><span className="dot" />{domain.label}</span> : "Not set"}</b>
          <em>{can(role, "domain.manage") ? <Link href={`/studio/${slug}/domain`}>{site.domain?.hostname ?? "Connect your domain →"}</Link> : (site.domain?.hostname ?? "Using the free address")}</em>
        </div>
      </div>

      {seeReservations ? (
        <div className="panel">
          <div className="card-h">
            <h2>Recent reservations</h2>
            <Link className="btn sm" href={`/studio/${slug}/reservations`}>All reservations →</Link>
          </div>
          {enrollments.length ? (
            <div className="table-box">
              <table className="table">
                <thead><tr><th>Learner</th><th>Course</th><th>Status</th></tr></thead>
                <tbody>
                  {enrollments.slice(0, 5).map((e) => (
                    <tr key={e.id}>
                      <td><b style={{ fontWeight: 500 }}>{e.name}</b><div className="mono muted">{e.email}</div></td>
                      <td>{byId.get(e.courseId)?.title ?? "Deleted course"}</td>
                      <td>{e.status === "paid" ? <span className="pill ok"><span className="dot" />Paid</span> : <span className="pill wait"><span className="dot" />Awaiting</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">No reservations yet. Share {publicHost(site)} with your students to get the first one.</p>
          )}
        </div>
      ) : (
        <div className="panel"><p className="empty">Learner reservations and contact details are visible to the owner, co-owners and support. Your role ({ROLE_META[role].label}) focuses on the brand and courses.</p></div>
      )}
    </>
  );
}
