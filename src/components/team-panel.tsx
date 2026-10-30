"use client";

import { useActionState, useState, useTransition } from "react";
import {
  cancelInvitation,
  inviteTeammate,
  leaveSite,
  removeTeammate,
  resendInvitation,
  setMemberRole,
  transferSite,
  type TeamResult,
} from "@/app/studio/team-actions";
import { ROLE_META } from "@/lib/roles";
import type { Role, TeamRole } from "@/lib/types";

// Dates arrive pre-formatted from the server so they render the same on server and client.
export type MemberRow = { id: string; name: string; email: string; role: Role; since: string; you: boolean; editable: boolean };
export type InviteRow = { id: string; email: string; role: TeamRole; invitedBy: string; sent: string; expires: string; editable: boolean };

type Props = {
  slug: string;
  viewerRole: Role;
  members: MemberRow[];
  invites: InviteRow[];
  assignable: TeamRole[];
  coowners: { id: string; name: string }[];
};

function useRunner() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TeamResult>({});
  const run = (fn: () => Promise<TeamResult>) =>
    start(async () => {
      setResult(await fn());
    });
  return { pending, result, run };
}

/** Asks once before a destructive action, inline. */
function Confirm({ label, confirmLabel, onConfirm, pending }: { label: string; confirmLabel: string; onConfirm: () => void; pending: boolean }) {
  const [armed, setArmed] = useState(false);
  if (!armed) return <button className="btn sm" type="button" onClick={() => setArmed(true)}>{label}</button>;
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button className="btn sm danger" type="button" disabled={pending} onClick={onConfirm}>{pending ? "…" : confirmLabel}</button>
      <button className="btn sm" type="button" onClick={() => setArmed(false)}>Cancel</button>
    </span>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="linkbox">
      <input className="input mono" readOnly value={link} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} />
      <button
        className="btn sm"
        type="button"
        onClick={() =>
          navigator.clipboard?.writeText(link).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => undefined,
          )
        }
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

function RolePill({ role }: { role: Role }) {
  return <span className={`pill role-${role}`}>{ROLE_META[role].label}</span>;
}

function MemberLine({ slug, member, assignable }: { slug: string; member: MemberRow; assignable: TeamRole[] }) {
  const { pending, result, run } = useRunner();
  return (
    <tr>
      <td>
        <div className="person">
          <span className="av-sm">{member.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontWeight: 500 }}>{member.name}{member.you && <span className="you"> · you</span>}</b>
            <div className="mono muted">{member.email}</div>
            {result.error && <div className="error" role="alert" style={{ fontSize: 12.5 }}>{result.error}</div>}
          </div>
        </div>
      </td>
      <td>
        {member.editable ? (
          <select
            className="input select"
            aria-label={`Role for ${member.name}`}
            value={member.role}
            disabled={pending}
            onChange={(e) => run(() => setMemberRole(slug, member.id, e.target.value))}
          >
            {assignable.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </select>
        ) : (
          <RolePill role={member.role} />
        )}
      </td>
      <td className="mono muted">{member.since}</td>
      <td>
        <div className="actions">
          {member.editable && <Confirm label="Remove" confirmLabel="Remove" pending={pending} onConfirm={() => run(() => removeTeammate(slug, member.id))} />}
        </div>
      </td>
    </tr>
  );
}

function InviteLine({ slug, invite }: { slug: string; invite: InviteRow }) {
  const { pending, result, run } = useRunner();
  return (
    <tr>
      <td>
        <b style={{ fontWeight: 500 }}>{invite.email}</b>
        <div className="mono muted">Invited by {invite.invitedBy} · sent {invite.sent} · expires {invite.expires}</div>
        {result.error && <div className="error" role="alert" style={{ fontSize: 12.5 }}>{result.error}</div>}
        {result.ok && <div className="hint" role="status" style={{ color: "var(--good)" }}>{result.ok}</div>}
        {result.link && <CopyLink link={result.link} />}
      </td>
      <td><RolePill role={invite.role} /></td>
      <td>
        <div className="actions">
          {invite.editable && (
            <>
              <button className="btn sm" type="button" disabled={pending} onClick={() => run(() => resendInvitation(slug, invite.id))}>{pending ? "…" : "Resend"}</button>
              <Confirm label="Cancel" confirmLabel="Cancel invite" pending={pending} onConfirm={() => run(() => cancelInvitation(slug, invite.id))} />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function InviteForm({ slug, assignable }: { slug: string; assignable: TeamRole[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>(assignable.includes("editor") ? "editor" : assignable[0]);
  const [state, action, pending] = useActionState(async (_: TeamResult, fd: FormData): Promise<TeamResult> => {
    const res = await inviteTeammate(slug, fd);
    if (res.ok) setEmail("");
    return res;
  }, {});

  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="invite-email">Email</label>
          <input className="input" id="invite-email" name="email" type="email" autoComplete="off" placeholder="assistant@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="invite-role">Role</label>
          <select className="input select" id="invite-role" name="role" value={role} onChange={(e) => setRole(e.target.value as TeamRole)}>
            {assignable.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </select>
        </div>
      </div>
      <p className="hint">{ROLE_META[role].blurb}</p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn gold" type="submit" disabled={pending}>{pending ? "Sending…" : "Send invitation"}</button>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        {state.ok && <p className="hint" role="status" style={{ color: "var(--good)" }}>{state.ok}</p>}
      </div>
      {state.link && (
        <div className="field">
          <label>Or share this link (it only works for the invited email address)</label>
          <CopyLink link={state.link} />
        </div>
      )}
    </form>
  );
}

function Danger({ slug, viewerRole, coowners }: { slug: string; viewerRole: Role; coowners: Props["coowners"] }) {
  const leave = useRunner();
  const transfer = useRunner();
  const [target, setTarget] = useState(coowners[0]?.id ?? "");

  return (
    <div className="card-b" style={{ display: "grid", gap: 18 }}>
      {viewerRole === "owner" ? (
        coowners.length > 0 ? (
          <div className="field">
            <label htmlFor="transfer-to">Transfer ownership</label>
            <p className="hint">The new owner can manage everyone, including you. You stay on as a co-owner. Only co-owners can receive ownership.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select className="input select" id="transfer-to" value={target} onChange={(e) => setTarget(e.target.value)}>
                {coowners.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Confirm label="Transfer…" confirmLabel="Yes, transfer ownership" pending={transfer.pending} onConfirm={() => transfer.run(() => transferSite(slug, target))} />
            </div>
            {transfer.result.error && <p className="error" role="alert">{transfer.result.error}</p>}
            {transfer.result.ok && <p className="hint" role="status" style={{ color: "var(--good)" }}>{transfer.result.ok}</p>}
          </div>
        ) : (
          <p className="hint">You&apos;re the owner. To hand the site over, first make a teammate a co-owner. Then you can transfer ownership to them.</p>
        )
      ) : (
        <div className="field">
          <label>Leave this site</label>
          <p className="hint">You&apos;ll lose access straight away. An owner or co-owner can invite you back.</p>
          <div>
            <Confirm label="Leave site" confirmLabel="Yes, leave" pending={leave.pending} onConfirm={() => leave.run(() => leaveSite(slug))} />
          </div>
          {leave.result.error && <p className="error" role="alert">{leave.result.error}</p>}
        </div>
      )}
    </div>
  );
}

export function TeamManager({ slug, viewerRole, members, invites, assignable, coowners }: Props) {
  const manage = assignable.length > 0;
  return (
    <>
      <div className="panel">
        <div className="card-h"><h2>{members.length} {members.length === 1 ? "person" : "people"} on this site</h2></div>
        <div className="table-box">
          <table className="table">
            <thead><tr><th>Teammate</th><th>Role</th><th>Joined</th><th /></tr></thead>
            <tbody>{members.map((m) => <MemberLine key={m.id} slug={slug} member={m} assignable={assignable} />)}</tbody>
          </table>
        </div>
      </div>

      {manage && invites.length > 0 && (
        <div className="panel">
          <div className="card-h"><h2>Pending invitations</h2><span className="mono muted">Valid for 7 days</span></div>
          <div className="table-box">
            <table className="table">
              <thead><tr><th>Invited</th><th>Role</th><th /></tr></thead>
              <tbody>{invites.map((i) => <InviteLine key={i.id} slug={slug} invite={i} />)}</tbody>
            </table>
          </div>
        </div>
      )}

      {manage && (
        <div className="panel">
          <div className="card-h"><h2>Invite a teammate</h2><span className="mono muted">They sign in with this email to accept</span></div>
          <div className="card-b"><InviteForm slug={slug} assignable={assignable} /></div>
        </div>
      )}

      <div className="panel">
        <div className="card-h"><h2>{viewerRole === "owner" ? "Ownership" : "Your access"}</h2></div>
        <Danger slug={slug} viewerRole={viewerRole} coowners={coowners} />
      </div>
    </>
  );
}
