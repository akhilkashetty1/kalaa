import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ROLE_META, assignableBy, can, canManage, rank } from "@/lib/roles";
import type { Creator, Invite, Role, Site, TeamRole } from "@/lib/types";
import { recordAudit as log } from "@/server/audit";
import { db, fromDoc, lockSite, withTransaction, type Tx } from "@/server/db";
import { roleOn } from "@/server/data/sites";

// Team rules. Each mutation runs in one transaction that first locks the site (db/transaction.ts) and
// then re-checks who is acting, so a teammate removed a moment ago can't finish an action they started.

/** A problem the person can fix or should be told about. Anything else is a bug and propagates. */
export class TeamError extends Error {}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PENDING_INVITES = 15;
const MAX_INVITE_EMAILS_PER_HOUR = 20;
const RESEND_COOLDOWN_MS = 60 * 1000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newInviteToken = () => randomBytes(24).toString("base64url");

type Ctx = { site: Site; actor: Creator; role: Role };

async function context(tx: Tx, siteId: string, actorId: string): Promise<Ctx> {
  await lockSite(tx, siteId);
  const { c, session } = tx;
  // Operations in one transaction run one at a time: a session is not safe for parallel use.
  const siteDoc = await c.sites.findOne({ _id: siteId }, { session });
  const actorDoc = await c.creators.findOne({ _id: actorId }, { session });
  const site = siteDoc && fromDoc<Site>(siteDoc);
  const actor = actorDoc && fromDoc<Creator>(actorDoc);
  const role = site && actor ? await roleOn(site, actor.id, tx) : null;
  if (!site || !actor || !role) throw new TeamError("You no longer have access to this site.");
  return { site, actor, role };
}

function requireManage(role: Role) {
  if (!can(role, "team.manage")) throw new TeamError(`Your role (${ROLE_META[role].label}) can't manage the team.`);
}

const label = (role: Role) => ROLE_META[role].label;

async function invitesSentLastHour({ c, session }: Tx, siteId: string) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return c.audit.countDocuments({ siteId, action: { $in: ["invite", "invite_resend"] }, at: { $gt: hourAgo } }, { session });
}

// ---- invitations ----

export type IssuedInvite = { token: string; email: string; role: TeamRole; siteName: string; inviterName: string };

/** Creates an invitation, or refreshes the pending one for that email with a new link and role. */
export async function inviteMember(input: { siteId: string; actorId: string; email: string; role: TeamRole }): Promise<IssuedInvite> {
  const token = newInviteToken();
  return withTransaction(async (tx) => {
    const { c, session } = tx;
    const { site, actor, role: actorRole } = await context(tx, input.siteId, input.actorId);
    requireManage(actorRole);
    if (!assignableBy(actorRole).includes(input.role)) throw new TeamError(`Your role can't invite someone as ${label(input.role)}.`);

    const now = Date.now();
    await c.invites.deleteMany({ siteId: site.id, expiresAt: { $lte: new Date(now).toISOString() } }, { session });

    const existing = await c.creators.findOne({ email: input.email }, { session });
    if (existing && (await roleOn(site, existing._id, tx))) throw new TeamError(`${input.email} is already on the team.`);
    if ((await invitesSentLastHour(tx, site.id)) >= MAX_INVITE_EMAILS_PER_HOUR) throw new TeamError("Too many invitations in the last hour. Try again later.");

    const invite = await c.invites.findOne({ siteId: site.id, email: input.email }, { session });
    if (invite) {
      if (now - Date.parse(invite.lastSentAt) < RESEND_COOLDOWN_MS) throw new TeamError("An invitation was just sent to this address. Wait a minute before sending another.");
    } else if ((await c.invites.countDocuments({ siteId: site.id }, { session })) >= MAX_PENDING_INVITES) {
      throw new TeamError("You have 15 pending invitations. Cancel some before inviting more.");
    }
    await c.invites.updateOne(
      { siteId: site.id, email: input.email },
      {
        $set: { role: input.role, invitedBy: actor.id, tokenHash: hashToken(token), lastSentAt: new Date(now).toISOString(), expiresAt: new Date(now + INVITE_TTL_MS).toISOString() },
        $setOnInsert: { _id: randomUUID(), createdAt: new Date(now).toISOString() },
      },
      { upsert: true, session },
    );

    await log(tx, site, actor, "invite", `Invited ${input.email} as ${label(input.role)}`);
    return { token, email: input.email, role: input.role, siteName: site.name, inviterName: actor.name };
  });
}

/** Issues a fresh link for a pending invitation (links are stored hashed, so the old one can't be re-read). */
export async function resendInvite(input: { siteId: string; actorId: string; inviteId: string }): Promise<IssuedInvite> {
  const token = newInviteToken();
  return withTransaction(async (tx) => {
    const { c, session } = tx;
    const { site, actor, role: actorRole } = await context(tx, input.siteId, input.actorId);
    requireManage(actorRole);
    const invite = await c.invites.findOne({ _id: input.inviteId, siteId: site.id }, { session });
    if (!invite) throw new TeamError("That invitation no longer exists.");
    if (!canManage(actorRole, invite.role)) throw new TeamError("Your role can't manage this invitation.");

    const now = Date.now();
    if (now - Date.parse(invite.lastSentAt) < RESEND_COOLDOWN_MS) throw new TeamError("Sent a moment ago. Wait a minute before sending again.");
    if ((await invitesSentLastHour(tx, site.id)) >= MAX_INVITE_EMAILS_PER_HOUR) throw new TeamError("Too many invitations in the last hour. Try again later.");

    await c.invites.updateOne(
      { _id: invite._id },
      { $set: { tokenHash: hashToken(token), lastSentAt: new Date(now).toISOString(), expiresAt: new Date(now + INVITE_TTL_MS).toISOString() } },
      { session },
    );
    await log(tx, site, actor, "invite_resend", `Resent the invitation to ${invite.email}`);
    return { token, email: invite.email, role: invite.role, siteName: site.name, inviterName: actor.name };
  });
}

export async function revokeInvite(input: { siteId: string; actorId: string; inviteId: string }) {
  return withTransaction(async (tx) => {
    const { c, session } = tx;
    const { site, actor, role: actorRole } = await context(tx, input.siteId, input.actorId);
    requireManage(actorRole);
    const invite = await c.invites.findOne({ _id: input.inviteId, siteId: site.id }, { session });
    if (!invite) return; // already gone
    if (!canManage(actorRole, invite.role)) throw new TeamError("Your role can't manage this invitation.");
    await c.invites.deleteOne({ _id: invite._id }, { session });
    await log(tx, site, actor, "invite_revoke", `Cancelled the invitation to ${invite.email}`);
  });
}

export type InviteView = { site: Pick<Site, "name" | "slug">; email: string; role: TeamRole; inviterName: string; expired: boolean };

export async function lookupInvite(token: string): Promise<InviteView | null> {
  const c = await db();
  const invite = await c.invites.findOne({ tokenHash: hashToken(token) });
  const site = invite && (await c.sites.findOne({ _id: invite.siteId }, { projection: { name: 1, slug: 1 } }));
  if (!invite || !site) return null;
  const inviter = await c.creators.findOne({ _id: invite.invitedBy }, { projection: { name: 1 } });
  return {
    site: { name: site.name, slug: site.slug },
    email: invite.email,
    role: invite.role,
    inviterName: inviter?.name ?? "A teammate",
    expired: Date.parse(invite.expiresAt) <= Date.now(),
  };
}

/** Accepting is a button press, never a link visit, so email scanners that open links can't use up an invitation. */
export async function acceptInvite(token: string, creatorId: string): Promise<{ slug: string }> {
  const tokenHash = hashToken(token);
  const outcome = await withTransaction(async (tx) => {
    const { c, session } = tx;
    const found = await c.invites.findOne({ tokenHash }, { session });
    if (!found || Date.parse(found.expiresAt) <= Date.now()) return { error: "This invitation has expired or was cancelled. Ask for a new one." };
    await lockSite(tx, found.siteId);
    // Re-read after taking the lock: the invitation may have been revoked or resent meanwhile.
    const inviteDoc = await c.invites.findOne({ _id: found._id, tokenHash }, { session });
    if (!inviteDoc) return { error: "This invitation has expired or was cancelled. Ask for a new one." };
    const invite = fromDoc<Invite>(inviteDoc);
    const creatorDoc = await c.creators.findOne({ _id: creatorId }, { session });
    if (!creatorDoc || creatorDoc.email !== invite.email) return { error: `This invitation was sent to ${invite.email}. Sign in with that address.` };
    const creator = fromDoc<Creator>(creatorDoc);
    const siteDoc = await c.sites.findOne({ _id: invite.siteId }, { session });
    await c.invites.deleteOne({ _id: invite.id }, { session });
    if (!siteDoc) return { error: "This site no longer exists." };
    const site = fromDoc<Site>(siteDoc);
    if (!(await roleOn(site, creator.id, tx))) {
      await c.memberships.insertOne({ _id: randomUUID(), siteId: site.id, creatorId: creator.id, role: invite.role, addedBy: invite.invitedBy, createdAt: new Date().toISOString() }, { session });
      await log(tx, site, creator, "join", `${creator.email} joined as ${label(invite.role)}`);
    }
    return { slug: site.slug };
  });
  // Errors are returned rather than thrown so a cancelled invitation for a deleted site is still cleaned up.
  if ("error" in outcome) throw new TeamError(outcome.error);
  return outcome;
}

// ---- members ----

export async function changeRole(input: { siteId: string; actorId: string; creatorId: string; role: TeamRole }) {
  return withTransaction(async (tx) => {
    const { c, session } = tx;
    const { site, actor, role: actorRole } = await context(tx, input.siteId, input.actorId);
    requireManage(actorRole);
    if (input.creatorId === site.ownerId) throw new TeamError("The owner's role can't be changed. Transfer ownership instead.");
    const membership = await c.memberships.findOne({ siteId: site.id, creatorId: input.creatorId }, { session });
    if (!membership) throw new TeamError("That person isn't on the team any more.");
    if (!canManage(actorRole, membership.role)) throw new TeamError(`Your role can't change a ${label(membership.role)}.`);
    if (!assignableBy(actorRole).includes(input.role)) throw new TeamError(`Your role can't make someone a ${label(input.role)}.`);
    if (membership.role === input.role) return;
    const target = await c.creators.findOne({ _id: input.creatorId }, { session, projection: { email: 1 } });
    await log(tx, site, actor, "role_change", `${target?.email ?? "A teammate"}: ${label(membership.role)} → ${label(input.role)}`);
    await c.memberships.updateOne({ _id: membership._id }, { $set: { role: input.role } }, { session });
  });
}

/** Removes a teammate, or lets someone leave (`creatorId` equal to the actor). The owner can do neither. */
export async function removeMember(input: { siteId: string; actorId: string; creatorId: string }) {
  return withTransaction(async (tx) => {
    const { c, session } = tx;
    const { site, actor, role: actorRole } = await context(tx, input.siteId, input.actorId);
    const membership = await c.memberships.findOne({ siteId: site.id, creatorId: input.creatorId }, { session });
    if (input.creatorId === site.ownerId) throw new TeamError("The owner can't be removed. Transfer ownership first.");
    if (!membership) throw new TeamError("That person isn't on the team any more.");
    const leaving = input.creatorId === actor.id;
    if (!leaving) {
      requireManage(actorRole);
      if (!canManage(actorRole, membership.role)) throw new TeamError(`Your role can't remove a ${label(membership.role)}.`);
    }
    const target = await c.creators.findOne({ _id: input.creatorId }, { session, projection: { email: 1 } });
    await c.memberships.deleteOne({ _id: membership._id }, { session });
    await log(tx, site, actor, leaving ? "leave" : "remove", leaving ? `${actor.email} left the team` : `Removed ${target?.email ?? "a teammate"} (${label(membership.role)})`);
  });
}

/** Hands the site to an existing co-owner. The previous owner stays on as a co-owner. */
export async function transferOwnership(input: { siteId: string; actorId: string; creatorId: string }) {
  return withTransaction(async (tx) => {
    const { c, session } = tx;
    const { site, actor, role: actorRole } = await context(tx, input.siteId, input.actorId);
    if (actorRole !== "owner") throw new TeamError("Only the owner can transfer ownership.");
    const target = await c.memberships.findOne({ siteId: site.id, creatorId: input.creatorId }, { session });
    if (!target || target.role !== "coowner") throw new TeamError("Ownership can only go to a co-owner. Make them a co-owner first.");
    const newOwner = await c.creators.findOne({ _id: input.creatorId }, { session, projection: { email: 1 } });
    await c.memberships.deleteOne({ _id: target._id }, { session });
    await c.memberships.insertOne({ _id: randomUUID(), siteId: site.id, creatorId: actor.id, role: "coowner", addedBy: actor.id, createdAt: new Date().toISOString() }, { session });
    await c.sites.updateOne({ _id: site.id }, { $set: { ownerId: input.creatorId } }, { session });
    await log(tx, site, actor, "transfer", `Transferred ownership to ${newOwner?.email ?? "a co-owner"}`);
  });
}

// ---- reading ----

export type TeamMemberView = { id: string; name: string; email: string; role: Role; since: string };
export type TeamInviteView = { id: string; email: string; role: TeamRole; invitedBy: string; expiresAt: string; lastSentAt: string };
export type AuditView = { id: string; actorEmail: string; detail: string; at: string };

export async function teamOf(site: Site) {
  const c = await db();
  const now = new Date().toISOString();
  const [memberships, invites, audit] = await Promise.all([
    c.memberships.find({ siteId: site.id }).toArray(),
    c.invites.find({ siteId: site.id, expiresAt: { $gt: now } }).sort({ lastSentAt: -1 }).toArray(),
    c.audit.find({ siteId: site.id }).sort({ at: -1 }).limit(15).toArray(),
  ]);
  const ids = [site.ownerId, ...memberships.map((m) => m.creatorId), ...invites.map((i) => i.invitedBy)];
  const byId = new Map((await c.creators.find({ _id: { $in: ids } }).toArray()).map((d) => [d._id, fromDoc<Creator>(d)]));

  const members: TeamMemberView[] = [];
  const owner = byId.get(site.ownerId);
  if (owner) members.push({ id: owner.id, name: owner.name, email: owner.email, role: "owner", since: site.createdAt });
  for (const m of memberships) {
    const person = byId.get(m.creatorId);
    if (person) members.push({ id: person.id, name: person.name, email: person.email, role: m.role, since: m.createdAt });
  }
  members.sort((a, b) => rank(b.role) - rank(a.role) || a.name.localeCompare(b.name));

  return {
    members,
    invites: invites.map((i): TeamInviteView => ({ id: i._id, email: i.email, role: i.role, invitedBy: byId.get(i.invitedBy)?.name ?? "A teammate", expiresAt: i.expiresAt, lastSentAt: i.lastSentAt })),
    audit: audit.map((a): AuditView => ({ id: a._id, actorEmail: a.actorEmail, detail: a.detail, at: a.at })),
  };
}
