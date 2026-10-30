import Link from "next/link";
import { redirect } from "next/navigation";
import { currentCreator } from "@/server/auth";
import { ROLE_META } from "@/lib/roles";
import { lookupInvite } from "@/server/team";
import { accept, switchAccount } from "./actions";

export const metadata = { title: "Invitation · Kalaa", robots: { index: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <div className="wrap">
        <header className="topbar"><Link href="/" className="logo"><i>क</i>Kalaa</Link></header>
        <div className="login"><div className="panel login-card">{children}</div></div>
      </div>
    </div>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await lookupInvite(token);

  if (!invite || invite.expired) {
    return (
      <Shell>
        <div className="eyebrow">Invitation</div>
        <h1>This link has expired</h1>
        <p className="muted">The invitation was cancelled, already used, or is older than 7 days. Ask the person who invited you to send a new one.</p>
        <Link className="btn" href="/studio">Go to the studio</Link>
      </Shell>
    );
  }

  const creator = await currentCreator();
  if (!creator) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const role = ROLE_META[invite.role];

  if (creator.email !== invite.email) {
    return (
      <Shell>
        <div className="eyebrow">Invitation</div>
        <h1>Wrong account</h1>
        <p className="muted">This invitation to {invite.site.name} was sent to <b>{invite.email}</b>, but you&apos;re signed in as <b>{creator.email}</b>.</p>
        <form action={switchAccount.bind(null, token)}><button className="btn gold" type="submit">Sign in as {invite.email}</button></form>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="eyebrow">Invitation</div>
      <h1>Join {invite.site.name}</h1>
      <p className="muted">{invite.inviterName} invited you as <b>{role.label}</b>.</p>
      <p className="hint">{role.blurb}</p>
      <form action={accept.bind(null, token)}><button className="btn gold" type="submit" style={{ width: "100%" }}>Accept and open the studio</button></form>
    </Shell>
  );
}
