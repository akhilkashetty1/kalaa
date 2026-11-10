"use server";

import { revalidatePath } from "next/cache";
import { AccessError, assertSiteAccess } from "@/server/auth";
import { deleteLead, setLeadStatus } from "@/server/leads";
import type { LeadStatus } from "@/lib/types";

// Leads inbox actions. Anyone who can see reservations can follow up (change status); deleting a lead is
// for owners and co-owners, like exporting the list.

type State = { error?: string; ok?: string };
const STATUSES: readonly LeadStatus[] = ["new", "contacted", "closed"];

export async function updateLeadStatus(slug: string, id: string, status: string): Promise<State> {
  try {
    const { site } = await assertSiteAccess(slug, "reservations.view");
    if (!STATUSES.includes(status as LeadStatus)) return { error: "Unknown status." };
    if (!(await setLeadStatus(site.id, id, status as LeadStatus))) return { error: "That lead no longer exists." };
    revalidatePath(`/studio/${slug}/leads`);
    return { ok: "Saved" };
  } catch (err) {
    if (err instanceof AccessError) return { error: err.message };
    throw err;
  }
}

export async function removeLead(slug: string, id: string): Promise<State> {
  try {
    const { site } = await assertSiteAccess(slug, "students.message");
    await deleteLead(site.id, id);
    revalidatePath(`/studio/${slug}`, "layout");
    return { ok: "Deleted" };
  } catch (err) {
    if (err instanceof AccessError) return { error: err.message };
    throw err;
  }
}
