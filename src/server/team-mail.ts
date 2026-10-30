import "server-only";
import { platformOrigin } from "@/lib/config";
import { escapeHtml as esc, oneLine, sendMail } from "@/server/mail";
import { ROLE_META } from "@/lib/roles";
import type { IssuedInvite } from "@/server/team";

export const inviteLink = (token: string) => `${platformOrigin()}/invite/${token}`;

export async function sendInviteMail(invite: IssuedInvite) {
  const site = oneLine(invite.siteName);
  const inviter = oneLine(invite.inviterName);
  const role = ROLE_META[invite.role];
  const link = inviteLink(invite.token);
  await sendMail({
    to: invite.email,
    subject: `${inviter} invited you to help run ${site} on Kalaa`,
    text: `${inviter} invited you to join ${site} on Kalaa as ${role.label}.\n\n${role.blurb}\n\nAccept the invitation (valid for 7 days):\n${link}\n\nSign in with this email address (${invite.email}) to accept. If you weren't expecting this, you can ignore it.`,
    html: `<p><b>${esc(inviter)}</b> invited you to join <b>${esc(site)}</b> on Kalaa as <b>${esc(role.label)}</b>.</p><p>${esc(role.blurb)}</p><p><a href="${esc(link)}">Accept the invitation</a> (valid for 7 days)</p><p>Sign in with this email address (${esc(invite.email)}) to accept. If you weren't expecting this, you can ignore it.</p>`,
  });
}
