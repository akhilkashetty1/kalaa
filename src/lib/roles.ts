import type { Membership, Role, Site, TeamRole } from "./types";

// Roles and permissions. Pure data and functions with no server imports, so the studio UI
// (client) and the checks in server actions read the same rules.

export type Permission = "reservations.view" | "students.message" | "payments.confirm" | "courses.manage" | "brand.manage" | "domain.manage" | "team.manage";

export const ROLES: readonly Role[] = ["owner", "coowner", "editor", "support"];

/** `rank` decides who may act on whom: you can only grant, change or remove roles below your own. */
export const ROLE_META: Record<Role, { label: string; rank: number; blurb: string }> = {
  owner: { label: "Owner", rank: 4, blurb: "Everything, including transferring the site. There is one owner." },
  coowner: { label: "Co-owner", rank: 3, blurb: "Runs the site day to day: brand, courses, learners and payments, domain, and the editors and support below them." },
  editor: { label: "Editor", rank: 2, blurb: "Edits the brand and courses. Can't see learner contact details or change the domain or team." },
  support: { label: "Support", rank: 1, blurb: "Sees seat reservations and learner contacts to follow up. Can't change anything on the site." },
};

const GRANTS: Record<Role, readonly Permission[]> = {
  owner: ["reservations.view", "students.message", "payments.confirm", "courses.manage", "brand.manage", "domain.manage", "team.manage"],
  coowner: ["reservations.view", "students.message", "payments.confirm", "courses.manage", "brand.manage", "domain.manage", "team.manage"],
  editor: ["courses.manage", "brand.manage"],
  support: ["reservations.view"],
};

/** Rows of the "what can each role do" table, in display order. */
export const PERMISSION_ROWS: { permission: Permission; label: string }[] = [
  { permission: "brand.manage", label: "Edit brand and theme" },
  { permission: "courses.manage", label: "Create and publish courses" },
  { permission: "reservations.view", label: "See reservations and learner contacts" },
  { permission: "payments.confirm", label: "Confirm payments and grant course access" },
  { permission: "students.message", label: "Email students and export the student list" },
  { permission: "domain.manage", label: "Connect a custom domain" },
  { permission: "team.manage", label: "Invite and remove teammates" },
];

export const can = (role: Role, permission: Permission) => GRANTS[role].includes(permission);
export const rank = (role: Role) => ROLE_META[role].rank;

/** Roles `role` may hand out: strictly below its own, and never "owner" (that is a transfer). */
export function assignableBy(role: Role): TeamRole[] {
  return ROLES.filter((r): r is TeamRole => r !== "owner" && rank(r) < rank(role));
}

/** Whether `actor` may change or remove someone currently holding `target`. */
export const canManage = (actor: Role, target: Role) => can(actor, "team.manage") && rank(target) < rank(actor);

/** The creator's role on a site, or null if they have no access. */
export function roleIn(memberships: Pick<Membership, "siteId" | "creatorId" | "role">[], site: Pick<Site, "id" | "ownerId">, creatorId: string): Role | null {
  if (site.ownerId === creatorId) return "owner";
  return memberships.find((m) => m.siteId === site.id && m.creatorId === creatorId)?.role ?? null;
}
