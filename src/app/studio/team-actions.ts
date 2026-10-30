"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AccessError, assertSiteAccess, normalizeEmail } from "@/server/auth";
import * as team from "@/server/team";
import { inviteLink, sendInviteMail } from "@/server/team-mail";
import type { TeamRole } from "@/lib/types";

// Team actions. The rules live in lib/team.ts and run inside the database write; these wrappers
// identify the caller, turn expected problems into messages, and refresh the studio.

export type TeamResult = { error?: string; ok?: string; link?: string };

const ROLE_IDS: readonly string[] = ["coowner", "editor", "support"];
const asTeamRole = (v: unknown): TeamRole | null => (ROLE_IDS.includes(String(v)) ? (String(v) as TeamRole) : null);

async function run(slug: string, fn: (ctx: { creatorId: string; siteId: string }) => Promise<TeamResult | void>): Promise<TeamResult> {
  try {
    // Any role may reach the team page; what each role may do is decided inside lib/team.ts.
    const { creator, site } = await assertSiteAccess(slug);
    const result = (await fn({ creatorId: creator.id, siteId: site.id })) ?? {};
    revalidatePath(`/studio/${slug}`, "layout");
    return result;
  } catch (err) {
    if (err instanceof team.TeamError || err instanceof AccessError) return { error: err.message };
    throw err;
  }
}

/** Emails the invitation. The link is returned too, so it can be shared on WhatsApp or if email fails. It only works for the invited address. */
async function deliver(issued: team.IssuedInvite): Promise<TeamResult> {
  const link = inviteLink(issued.token);
  try {
    await sendInviteMail(issued);
  } catch (err) {
    console.error(err);
    return { ok: `Invitation saved, but we couldn't send the email to ${issued.email}. Share the link below instead.`, link };
  }
  return { ok: `Invitation sent to ${issued.email}.`, link };
}

export async function inviteTeammate(slug: string, formData: FormData): Promise<TeamResult> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const role = asTeamRole(formData.get("role"));
  if (!email) return { error: "Enter a valid email address." };
  if (!role) return { error: "Choose a role." };
  return run(slug, async ({ creatorId, siteId }) => deliver(await team.inviteMember({ siteId, actorId: creatorId, email, role })));
}

export async function resendInvitation(slug: string, inviteId: string): Promise<TeamResult> {
  return run(slug, async ({ creatorId, siteId }) => deliver(await team.resendInvite({ siteId, actorId: creatorId, inviteId })));
}

export async function cancelInvitation(slug: string, inviteId: string): Promise<TeamResult> {
  return run(slug, async ({ creatorId, siteId }) => {
    await team.revokeInvite({ siteId, actorId: creatorId, inviteId });
  });
}

export async function setMemberRole(slug: string, memberId: string, roleValue: string): Promise<TeamResult> {
  const role = asTeamRole(roleValue);
  if (!role) return { error: "Choose a role." };
  return run(slug, async ({ creatorId, siteId }) => {
    await team.changeRole({ siteId, actorId: creatorId, creatorId: memberId, role });
  });
}

export async function removeTeammate(slug: string, memberId: string): Promise<TeamResult> {
  return run(slug, async ({ creatorId, siteId }) => {
    await team.removeMember({ siteId, actorId: creatorId, creatorId: memberId });
  });
}

export async function leaveSite(slug: string): Promise<TeamResult> {
  const res = await run(slug, async ({ creatorId, siteId }) => {
    await team.removeMember({ siteId, actorId: creatorId, creatorId });
  });
  if (res.error) return res;
  redirect("/studio");
}

export async function transferSite(slug: string, memberId: string): Promise<TeamResult> {
  return run(slug, async ({ creatorId, siteId }) => {
    await team.transferOwnership({ siteId, actorId: creatorId, creatorId: memberId });
    return { ok: "Ownership transferred. You're now a co-owner." };
  });
}
