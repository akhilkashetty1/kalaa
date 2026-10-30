import "server-only";
import { randomUUID } from "node:crypto";
import { recordAudit } from "@/server/audit";
import { db, fromDoc, lockSite, withTransaction } from "@/server/db";
import { escapeHtml, oneLine, sendMail } from "@/server/mail";
import { MAX_BODY, MAX_SUBJECT } from "@/lib/announce-limits";
import type { Announcement, Creator, Site } from "@/lib/types";

// Announcement emails to the paid students of one course. Only people whose payment was confirmed are
// mailed, never the whole list. Sending is capped, logged and attributed.

export const MAX_RECIPIENTS = 500;
export const MAX_PER_DAY = 5;
export { MAX_BODY, MAX_SUBJECT } from "@/lib/announce-limits";
const CONCURRENCY = 8;

export class AnnounceError extends Error {}

/** Paid students of a course, one per email address. */
export async function paidStudents(siteId: string, courseId: string) {
  const paid = await (await db()).enrollments.find({ siteId, courseId, status: "paid" }, { projection: { email: 1, name: 1 } }).sort({ createdAt: 1 }).toArray();
  const seen = new Map<string, string>();
  for (const e of paid) if (!seen.has(e.email)) seen.set(e.email, e.name);
  return [...seen].map(([email, name]) => ({ email, name }));
}

export async function listAnnouncements(siteId: string) {
  const docs = await (await db()).announcements.find({ siteId }).sort({ sentAt: -1 }).toArray();
  return docs.map((d) => fromDoc<Announcement>(d));
}

function compose(site: Site, courseTitle: string, name: string, body: string) {
  const first = oneLine(name).split(" ")[0] || "there";
  const teacher = oneLine(site.creator.name);
  const footer = `You're getting this because you're enrolled in “${oneLine(courseTitle)}” on ${oneLine(site.name)}. Reply to this email to reach ${teacher}.`;
  const paragraphs = escapeHtml(body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return {
    text: `Hi ${first},\n\n${body}\n\n—\n${teacher}, ${oneLine(site.name)}\n${footer}`,
    html: `<p style="margin:0 0 14px">Hi ${escapeHtml(first)},</p>${paragraphs}<hr style="border:0;border-top:1px solid #ddd;margin:22px 0"><p style="margin:0;color:#666;font-size:13px">${escapeHtml(teacher)}, ${escapeHtml(oneLine(site.name))}<br>${escapeHtml(footer)}</p>`,
  };
}

export type AnnounceInput = { site: Site; courseId: string; subject: string; body: string; sender: Creator; test: boolean };

/** Sends the announcement, or one test copy to the sender. Returns how many went out. */
export async function sendAnnouncement(input: AnnounceInput): Promise<{ sent: number; failed: number; test: boolean }> {
  const subject = oneLine(input.subject).slice(0, MAX_SUBJECT);
  const body = input.body.replace(/\r\n?/g, "\n").trim().slice(0, MAX_BODY);
  if (!subject) throw new AnnounceError("Add a subject.");
  if (!body) throw new AnnounceError("Write a message.");

  const course = await (await db()).courses.findOne({ _id: input.courseId, siteId: input.site.id }, { projection: { title: 1 } });
  if (!course) throw new AnnounceError("Choose a course.");

  const people = input.test ? [{ email: input.sender.email, name: input.sender.name }] : await paidStudents(input.site.id, course._id);
  if (!people.length) throw new AnnounceError("No one has paid for this course yet.");
  if (people.length > MAX_RECIPIENTS) throw new AnnounceError(`This course has ${people.length} paid students. You can email up to ${MAX_RECIPIENTS} at once.`);

  let recordId: string | null = null;
  if (!input.test) {
    // The daily limit and the record are written together, so two quick sends can't both slip under it.
    recordId = await withTransaction(async (tx) => {
      const { c, session } = tx;
      await lockSite(tx, input.site.id);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      if ((await c.announcements.countDocuments({ siteId: input.site.id, sentAt: { $gt: dayAgo } }, { session })) >= MAX_PER_DAY) {
        throw new AnnounceError(`You've already sent ${MAX_PER_DAY} announcements today. Try again tomorrow.`);
      }
      const id = randomUUID();
      await c.announcements.insertOne({ _id: id, siteId: input.site.id, courseId: course._id, courseTitle: course.title, subject, body, sentBy: input.sender.email, sentAt: new Date().toISOString(), recipients: people.length, delivered: 0, failed: 0 }, { session });
      await recordAudit(tx, input.site, input.sender, "announce", `Emailed ${people.length} ${people.length === 1 ? "student" : "students"} of “${course.title}”: ${subject}`);
      return id;
    });
  }

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < people.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(
      people.slice(i, i + CONCURRENCY).map((p) => {
        const m = compose(input.site, course.title, p.name, body);
        return sendMail({ to: p.email, subject: input.test ? `[Test] ${subject}` : subject, text: m.text, html: m.html, replyTo: input.sender.email, fromName: input.site.creator.name });
      }),
    );
    for (const r of results) r.status === "fulfilled" ? sent++ : failed++;
  }

  if (recordId) {
    await (await db()).announcements.updateOne({ _id: recordId }, { $set: { delivered: sent, failed } });
  }
  return { sent, failed, test: input.test };
}
