import "server-only";
import { randomUUID } from "node:crypto";
import { findForm, type FormConfig } from "@/lib/custom";
import type { Lead, LeadStatus, Site } from "@/lib/types";
import { db, fromDoc, toDoc } from "@/server/db";
import { UserError } from "@/server/errors";
import { escapeHtml, oneLine, sendMail } from "@/server/mail";
import { normalizeEmail } from "@/server/otp";
import { takeToken } from "@/server/rate-limit";

// Leads: people who filled in a form on a storefront. What a form asks is decided by the published site
// (found by the form's element id), never by what the browser claims. Submissions are rate limited per
// address, per email and per site, and a hidden field plus a minimum fill-in time turn away most bots.

export class LeadError extends UserError {}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MIN_FILL_MS = 1500;

export type LeadInput = { formId: string; values: Record<string, unknown>; consent: boolean; hp: string; elapsed: number; path: string };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "");
const oneLineText = (v: unknown, max: number) => text(v, max).replace(/\s+/g, " ");

function cleanPhone(v: unknown): string {
  const digits = text(v, 30).replace(/[^\d+]/g, "");
  const plain = digits.replace(/\D/g, "");
  return plain.length >= 8 && plain.length <= 15 ? digits.slice(0, 16) : "";
}

/** Everyone who should hear about a new lead: the owner and co-owners. */
async function recipients(site: Site): Promise<string[]> {
  const c = await db();
  const co = await c.memberships.find({ siteId: site.id, role: "coowner" }, { projection: { creatorId: 1 } }).toArray();
  const ids = [site.ownerId, ...co.map((m) => m.creatorId)];
  return (await c.creators.find({ _id: { $in: ids } }, { projection: { email: 1 } }).toArray()).map((x) => x.email);
}

async function notify(site: Site, form: FormConfig, lead: Lead) {
  const to = await recipients(site);
  if (!to.length) return;
  const rows: [string, string][] = [["Name", lead.name], ["Email", lead.email], ...(lead.phone ? ([["Phone", lead.phone]] as [string, string][]) : []), ...(lead.message ? ([["Message", lead.message]] as [string, string][]) : []), ...lead.answers.map((a) => [a.label, a.value] as [string, string])];
  const subject = `New lead: ${oneLine(form.title)}`.slice(0, 120);
  const bodyText = `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nForm: ${form.title}${lead.source ? ` (${lead.source})` : ""}\nSee all leads in your Kalaa studio.`;
  const html = `<p><b>${escapeHtml(oneLine(form.title))}</b>${lead.source ? ` · ${escapeHtml(lead.source)}` : ""}</p><table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#666;vertical-align:top">${escapeHtml(k)}</td><td>${escapeHtml(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}</table><p style="color:#666">Reply to this email to answer them directly.</p>`;
  await Promise.all(to.map((address) => sendMail({ to: address, subject, text: bodyText, html, replyTo: lead.email }).catch((err) => console.error("[kalaa leads] notification failed", err))));
}

/** Validates and stores one submission. Returns the thank-you message, or throws a LeadError the visitor can act on. */
export async function submitLead(site: Site, input: LeadInput, ip: string): Promise<{ message: string }> {
  const form = findForm(site, String(input.formId ?? ""));
  if (!form) throw new LeadError("This form isn't available any more. Reload the page and try again.");

  // Bots fill every field and do it instantly. They get a normal-looking reply and nothing is stored.
  if (text(input.hp, 50) || !Number.isFinite(input.elapsed) || input.elapsed < MIN_FILL_MS) return { message: form.success };

  const v = input.values ?? {};
  const name = oneLineText(v.name, 80);
  const email = normalizeEmail(text(v.email, 254));
  if (!name) throw new LeadError("Please enter your name.");
  if (!email) throw new LeadError("Please enter a valid email address.");
  const phone = form.phone ? cleanPhone(v.phone) : "";
  if (form.phoneRequired && !phone) throw new LeadError("Please enter a valid phone number.");
  if (form.phone && !form.phoneRequired && text(v.phone, 30) && !phone) throw new LeadError("That phone number doesn't look right.");
  const message = form.message ? text(v.message, 1000) : "";
  const answers = form.questions.map((q, i) => ({ label: q.label, value: text((v.answers as Record<string, unknown> | undefined)?.[String(i)], 300) }));
  for (const [i, q] of form.questions.entries()) if (q.required && !answers[i].value) throw new LeadError(`Please answer: ${q.label}`);
  if (form.consent && input.consent !== true) throw new LeadError("Please tick the box to agree before sending.");

  const subject = `${site.id}`;
  const ok = (await takeToken("lead-ip", `${subject}:${ip}`, 8, HOUR)) && (await takeToken("lead-email", `${subject}:${email}`, 3, DAY)) && (await takeToken("lead-site", subject, 300, HOUR));
  if (!ok) throw new LeadError("Too many submissions from you. Please try again later.");

  const lead: Lead = {
    id: randomUUID(),
    siteId: site.id,
    form: form.title,
    source: text(input.path, 120).startsWith("/") ? text(input.path, 120) : "",
    name,
    email,
    ...(phone ? { phone } : {}),
    ...(message ? { message } : {}),
    answers: answers.filter((a) => a.value),
    consent: !!form.consent && input.consent === true,
    status: "new",
    createdAt: new Date().toISOString(),
  };
  await (await db()).leads.insertOne(toDoc(lead));
  if (form.notify) await notify(site, form, lead);
  return { message: form.success };
}

// ---- the studio's inbox ----

export async function listLeads(siteId: string, opts: { status?: LeadStatus; q?: string } = {}) {
  const filter: Record<string, unknown> = { siteId, ...(opts.status ? { status: opts.status } : {}) };
  const docs = await (await db()).leads.find(filter).sort({ createdAt: -1 }).limit(1000).toArray();
  const q = (opts.q ?? "").trim().toLowerCase();
  const leads = docs.map((d) => fromDoc<Lead>(d));
  return q ? leads.filter((l) => `${l.name} ${l.email} ${l.phone ?? ""} ${l.form} ${l.message ?? ""}`.toLowerCase().includes(q)) : leads;
}

export async function leadCounts(siteId: string) {
  const rows = await (await db()).leads.aggregate<{ _id: LeadStatus; n: number }>([{ $match: { siteId } }, { $group: { _id: "$status", n: { $sum: 1 } } }]).toArray();
  const by = Object.fromEntries(rows.map((r) => [r._id, r.n])) as Partial<Record<LeadStatus, number>>;
  return { new: by.new ?? 0, contacted: by.contacted ?? 0, closed: by.closed ?? 0, all: rows.reduce((n, r) => n + r.n, 0) };
}

export async function setLeadStatus(siteId: string, id: string, status: LeadStatus) {
  return ((await (await db()).leads.updateOne({ _id: id, siteId }, { $set: { status } })).matchedCount ?? 0) > 0;
}

export async function deleteLead(siteId: string, id: string) {
  return ((await (await db()).leads.deleteOne({ _id: id, siteId })).deletedCount ?? 0) > 0;
}
