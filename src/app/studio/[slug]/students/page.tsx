import Link from "next/link";
import { AnnouncementForm } from "@/components/announcement-form";
import { NoAccess } from "@/components/no-access";
import { requireSiteAccess } from "@/server/auth";
import { listAnnouncements, studentsOf } from "@/server/data";
import { whatsappLink } from "@/lib/phone";
import { can } from "@/lib/roles";

const FILTERS = [["all", "Everyone"], ["paid", "Paid"], ["waiting", "Waiting for payment"], ["browsing", "Just signed in"]] as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default async function StudentsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; f?: string; c?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { site, role, creator, allowed } = await requireSiteAccess(slug, "reservations.view");
  if (!allowed) return <NoAccess role={role} slug={slug} what="Student list and progress" />;
  const [{ rows, courses }, history] = await Promise.all([studentsOf(site.id), listAnnouncements(site.id)]);
  const canMessage = can(role, "students.message");

  const q = (sp.q ?? "").trim().toLowerCase();
  const f = FILTERS.some(([k]) => k === sp.f) ? sp.f! : "all";
  const c = courses.some((x) => x.id === sp.c) ? sp.c! : "";
  const shown = rows.filter((r) =>
    (f === "all" || r.status === f) &&
    (!c || r.courses.some((x) => x.courseId === c)) &&
    (!q || `${r.name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q)));
  const count = (k: string) => (k === "all" ? rows.length : rows.filter((r) => r.status === k).length);

  return (
    <>
      <div className="ws-head"><div><div className="eyebrow">Students</div><h1>Everyone in your classroom</h1></div>
        {canMessage && rows.length > 0 && <a className="btn sm" href={`/api/studio/students?site=${slug}`}>Download CSV</a>}
      </div>

      {canMessage && (
        <div className="panel">
          <div className="card-h"><h2>Email your students</h2><span className="mono muted">Paid students only</span></div>
          <AnnouncementForm slug={slug} senderEmail={creator.email} courses={courses.map((x) => ({ id: x.id, title: x.title, paid: x.paid }))} />
        </div>
      )}

      <div className="panel">
        <div className="card-h"><h2>{shown.length} of {rows.length} students</h2></div>
        <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 18px 14px" }}>
          <input className="input" name="q" defaultValue={sp.q ?? ""} placeholder="Search name, email or phone" style={{ maxWidth: 280 }} aria-label="Search students" />
          <select className="input" name="f" defaultValue={f} style={{ maxWidth: 220 }} aria-label="Status">
            {FILTERS.map(([k, label]) => <option key={k} value={k}>{label} ({count(k)})</option>)}
          </select>
          <select className="input" name="c" defaultValue={c} style={{ maxWidth: 240 }} aria-label="Course">
            <option value="">All courses</option>
            {courses.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
          <button className="btn sm" type="submit">Filter</button>
          {(q || f !== "all" || c) && <Link className="btn sm" href={`/studio/${slug}/students`}>Clear</Link>}
        </form>
        {shown.length ? (
          <div className="table-box">
            <table className="table">
              <thead><tr><th>Student</th><th>Courses and progress</th><th>Status</th><th>Last active</th><th /></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.email}>
                    <td><b style={{ fontWeight: 500 }}>{r.name}</b><div className="mono muted">{r.email}{r.phone ? ` · ${r.phone}` : ""}</div></td>
                    <td>{r.courses.length ? r.courses.map((x) => (
                      <div key={x.courseId}>{x.title} <span className="mono muted">{x.status === "paid" ? `${x.done} / ${x.total} lessons` : "waiting for payment"}</span></div>
                    )) : <span className="muted">No reservation yet</span>}</td>
                    <td>{r.status === "paid" ? <span className="pill ok"><span className="dot" />Paid</span> : r.status === "waiting" ? <span className="pill wait"><span className="dot" />Waiting</span> : <span className="pill"><span className="dot" />Signed in</span>}</td>
                    <td className="mono muted">{when(r.lastActive)}</td>
                    <td><div className="actions">{r.phone && <a className="btn sm" href={whatsappLink(r.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">{rows.length ? "No students match those filters." : "Nobody has signed in or reserved a seat yet. They will show up here as soon as they do."}</p>
        )}
      </div>

      {canMessage && history.length > 0 && (
        <div className="panel">
          <div className="card-h"><h2>Sent announcements</h2></div>
          <div className="table-box">
            <table className="table">
              <thead><tr><th>Subject</th><th>Course</th><th>Sent</th><th>Delivered</th></tr></thead>
              <tbody>
                {history.map((a) => (
                  <tr key={a.id}><td>{a.subject}</td><td>{a.courseTitle}</td><td className="mono muted">{when(a.sentAt)}</td><td className="mono">{a.delivered} / {a.recipients}{a.failed ? ` · ${a.failed} failed` : ""}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
