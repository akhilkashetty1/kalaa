"use server";

import { createHash } from "node:crypto";
import { clientIp } from "@/server/client-ip";
import { LeadError, submitLead as store, type LeadInput } from "@/server/leads";
import { siteFromHost } from "@/server/tenant";

// The public endpoint for storefront forms. Anyone can call it, so it validates everything itself:
// the site comes from the request's own host and the form's settings from the published site.

export type LeadResult = { ok: true; message: string } | { ok: false; error: string };

export async function submitLead(input: LeadInput): Promise<LeadResult> {
  try {
    const ip = createHash("sha256").update(await clientIp()).digest("hex").slice(0, 24); // never stored in the clear
    const site = await siteFromHost();
    return { ok: true, ...(await store(site, input, ip)) };
  } catch (err) {
    if (err instanceof LeadError) return { ok: false, error: err.message };
    console.error("[kalaa leads] submit failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
