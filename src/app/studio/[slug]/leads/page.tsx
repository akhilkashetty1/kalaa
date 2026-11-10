import { LeadDelete, LeadStatus } from "@/components/lead-status";
import { NoAccess } from "@/components/no-access";
import { requireSiteAccess } from "@/server/auth";
import { leadCounts, listLeads } from "@/server/leads";
import { whatsappLink } from "@/lib/phone";
import { can } from "@/lib/roles";
import type { LeadStatus as Status } from "@/lib/types";

const FILTERS = [["all", "All"], ["new", "New"], ["contacted", "Contacted"], ["closed", "Closed"]] as const;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default async function LeadsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ f?: string; q?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { site, role, allowed } = await requireSiteAccess(slug, "reservations.view");
  if (!allowed) return <NoAccess role={role} slug={slug} what="Leads from your site's forms" />;
  const f = FILTERS.some(([k]) => k === sp.f) ? (sp.f as "all" | Status) : "all";
  const q = (sp.q ?? "").trim();
  const [counts, leads] = await Promise.all([leadCounts(site.id), listLeads(site.id, { status: f === "all" ? undefined : f, q })]);
  const canExport = can(role, "students.message");

  return (
    <>
      <div className="ws-head">
        <div><div className="eyebrow">Leads</div><h1>People who filled in your forms</h1></div>
        {canExport && counts.all > 0 && <a className="btn sm" href={`/api/studio/leads?site=${slug}`}>Download CSV</a>}
      </div>

      <div className="panel">
        <div className="card-h">
          <h2>{leads.length} {leads.length === 1 ? "lead" : "leads"}</h2>
          <form className="actions" action={`/studio/${slug}/leads`} method="get">
            {f !== "all" && <input type="hidden" name="f" value={f} />}
            <input className="input" name="q" defaultValue={q} placeholder="Search name, email, phone" aria-label="Search leads" style={{ width: 220 }} />
            <button className="btn sm" type="submit">Search</button>
          </form>
        </div>
        <div className="actions" style={{ padding: "0 18px 12px", flexWrap: "wrap" }}>
          {FILTERS.map(([k, label]) => (
            <a key={k} className={`btn sm${f === k ? " gold" : ""}`} href={`/studio/${slug}/leads${k === "all" ? "" : `?f=${k}`}${q ? `${k === "all" ? "?" : "&"}q=${encodeURIComponent(q)}` : ""}`} aria-current={f === k ? "page" : undefined}>
              {label} · {counts[k]}
            </a>
          ))}
        </div>

        {leads.length ? (
          <div className="table-box">
            <table className="table">
              <thead><tr><th>Who</th><th>Form</th><th>What they said</th><th>Status</th><th /></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <b style={{ fontWeight: 500 }}>{l.name}</b>
                      <div className="mono muted">{l.email}{l.phone ? ` · ${l.phone}` : ""}</div>
                      <div className="mono muted">{when(l.createdAt)}</div>
                    </td>
                    <td>{l.form}{l.source && <div className="mono muted">{l.source}</div>}{l.consent && <div className="mono muted">agreed to be contacted</div>}</td>
                    <td style={{ maxWidth: 320 }}>
                      {l.message && <div style={{ whiteSpace: "pre-wrap" }}>{l.message}</div>}
                      {l.answers.map((a, i) => <div key={i} className="mono muted">{a.label}: <span style={{ color: "var(--chalk)" }}>{a.value}</span></div>)}
                      {!l.message && l.answers.length === 0 && <span className="muted">—</span>}
                    </td>
                    <td><LeadStatus slug={slug} id={l.id} status={l.status} /></td>
                    <td>
                      <div className="actions">
                        <a className="btn sm" href={`mailto:${l.email}`}>Email</a>
                        {l.phone && <a className="btn sm" href={whatsappLink(l.phone)} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                        {canExport && <LeadDelete slug={slug} id={l.id} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">{counts.all === 0 ? "No leads yet. Add a “Contact form” section to your site from the editor (Add → Build your own → Contact form) and every enquiry will show up here." : "No leads match."}</p>
        )}
      </div>
    </>
  );
}
