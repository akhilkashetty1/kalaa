import { NoAccess } from "@/components/no-access";
import { ReservationActions } from "@/components/reservation-actions";
import { requireSiteAccess } from "@/server/auth";
import { inr } from "@/lib/i18n";
import { completedCounts, listCourses, listEnrollments } from "@/server/data";
import { whatsappLink as whatsapp } from "@/lib/phone";
import { can } from "@/lib/roles";

export default async function ReservationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site, role, allowed } = await requireSiteAccess(slug, "reservations.view");
  if (!allowed) return <NoAccess role={role} slug={slug} what="Reservations and learner contacts" />;
  const [courses, enrollments, counts] = await Promise.all([listCourses(site.id), listEnrollments(site.id), completedCounts(site.id)]);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const canConfirm = can(role, "payments.confirm");
  const paid = enrollments.filter((e) => e.status === "paid");

  return (
    <>
      <div className="ws-head"><div><div className="eyebrow">Reservations</div><h1>Seats and payments</h1></div></div>
      <div className="panel">
        <div className="card-h">
          <h2>{enrollments.length} reservations</h2>
          <span className="mono muted">{paid.length} paid · {enrollments.length - paid.length} awaiting payment</span>
        </div>
        {!canConfirm && enrollments.length > 0 && <p className="hint" style={{ padding: "0 18px 12px" }}>Your role can follow up with learners. An owner or co-owner confirms payments.</p>}
        {enrollments.length ? (
          <div className="table-box">
            <table className="table">
              <thead><tr><th>Learner</th><th>Course</th><th>Value</th><th>Status</th><th>Progress</th><th /></tr></thead>
              <tbody>
                {enrollments.map((e) => (
                  <tr key={e.id}>
                    <td><b style={{ fontWeight: 500 }}>{e.name}</b><div className="mono muted">{e.email} · {e.phone}</div></td>
                    <td>{byId.get(e.courseId)?.title ?? "Deleted course"}<div className="mono muted">{new Date(e.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div></td>
                    <td className="num">{inr(byId.get(e.courseId)?.priceInr ?? 0)}</td>
                    <td>{e.status === "paid" ? <span className="pill ok"><span className="dot" />Paid</span> : <span className="pill wait"><span className="dot" />Awaiting payment</span>}</td>
                    <td className="mono">{e.status === "paid" ? `${counts.get(`${e.email}|${e.courseId}`) ?? 0} / ${byId.get(e.courseId)?.lessons.length ?? 0}` : "–"}</td>
                    <td>
                      <div className="actions">
                        <a className="btn sm" href={whatsapp(e.phone)} target="_blank" rel="noopener">WhatsApp</a>
                        {canConfirm && <ReservationActions slug={slug} enrollmentId={e.id} paid={e.status === "paid"} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No reservations yet.</p>
        )}
      </div>
    </>
  );
}
