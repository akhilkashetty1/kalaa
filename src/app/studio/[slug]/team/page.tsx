import { TeamManager, type InviteRow, type MemberRow } from "@/components/team-panel";
import { requireSiteAccess } from "@/server/auth";
import { PERMISSION_ROWS, ROLES, ROLE_META, assignableBy, can, canManage } from "@/lib/roles";
import { teamOf } from "@/server/team";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export const metadata = { title: "Team · Kalaa" };

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site, creator, role } = await requireSiteAccess(slug);
  const { members, invites, audit } = await teamOf(site);
  const manage = can(role, "team.manage");

  const memberRows: MemberRow[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    since: day(m.since),
    you: m.id === creator.id,
    editable: m.id !== creator.id && canManage(role, m.role),
  }));
  const inviteRows: InviteRow[] = invites.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    invitedBy: i.invitedBy,
    sent: day(i.lastSentAt),
    expires: day(i.expiresAt),
    editable: canManage(role, i.role),
  }));
  const coowners = members.filter((m) => m.role === "coowner").map((m) => ({ id: m.id, name: m.name }));

  return (
    <>
      <div className="ws-head">
        <div><div className="eyebrow">Team</div><h1>Who runs {site.name}</h1></div>
        <div className="row"><span className={`pill role-${role}`}>You&apos;re {ROLE_META[role].label.toLowerCase()}</span></div>
      </div>

      <TeamManager slug={slug} viewerRole={role} members={memberRows} invites={inviteRows} assignable={manage ? assignableBy(role) : []} coowners={coowners} />

      <div className="panel">
        <div className="card-h"><h2>What each role can do</h2></div>
        <div className="table-box">
          <table className="table matrix">
            <thead>
              <tr><th />{ROLES.map((r) => <th key={r} className={r === role ? "me" : ""}>{ROLE_META[r].label}</th>)}</tr>
            </thead>
            <tbody>
              {PERMISSION_ROWS.map((row) => (
                <tr key={row.permission}>
                  <td>{row.label}</td>
                  {ROLES.map((r) => (
                    <td key={r} className={r === role ? "me" : ""} aria-label={can(r, row.permission) ? "Yes" : "No"}>{can(r, row.permission) ? "✓" : "–"}</td>
                  ))}
                </tr>
              ))}
              <tr><td>Transfer ownership</td>{ROLES.map((r) => <td key={r} className={r === role ? "me" : ""} aria-label={r === "owner" ? "Yes" : "No"}>{r === "owner" ? "✓" : "–"}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ padding: "12px 18px 16px" }}>You can only invite, change or remove people whose role is below yours. Co-owners manage editors and support. Only the owner manages co-owners.</p>
      </div>

      {manage && (
        <div className="panel">
          <div className="card-h"><h2>Recent activity</h2></div>
          {audit.length ? (
            <ul className="activity">
              {audit.map((a) => (
                <li key={a.id}><span>{a.detail}<small className="mono muted"> · by {a.actorEmail}</small></span><time className="mono muted">{when(a.at)}</time></li>
              ))}
            </ul>
          ) : (
            <p className="empty">Nothing yet. Invitations, role changes, payment confirmations and removals will appear here.</p>
          )}
        </div>
      )}
    </>
  );
}
