import "server-only";
import { randomUUID } from "node:crypto";
import type { Creator, Enrollment } from "@/lib/types";
import { recordAudit } from "@/server/audit";
import { db, fromDoc, lockSite, toDoc, withTransaction } from "@/server/db";

export async function createEnrollment(input: Omit<Enrollment, "id" | "createdAt" | "status">) {
  const e: Enrollment = { ...input, id: randomUUID(), status: "pending_payment", createdAt: new Date().toISOString() };
  await (await db()).enrollments.insertOne(toDoc(e));
  return e;
}

export async function listEnrollments(siteId: string) {
  const docs = await (await db()).enrollments.find({ siteId }).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => fromDoc<Enrollment>(d));
}

/** What a learner has bought or reserved on a site. Matched by email, which sign-in has proven they control. */
export async function learnerAccess(siteId: string, email: string) {
  const mine = await (await db()).enrollments.find({ siteId, email }, { projection: { courseId: 1, status: 1 } }).toArray();
  return {
    paid: new Set(mine.filter((e) => e.status === "paid").map((e) => e.courseId)),
    pending: new Set(mine.filter((e) => e.status !== "paid").map((e) => e.courseId)),
  };
}

export async function setEnrollmentPaid(input: { siteId: string; enrollmentId: string; paid: boolean; actor: Creator }) {
  return withTransaction(async (tx) => {
    const { c, session } = tx;
    await lockSite(tx, input.siteId);
    const site = await c.sites.findOne({ _id: input.siteId }, { session, projection: { name: 1 } });
    const doc = await c.enrollments.findOne({ _id: input.enrollmentId, siteId: input.siteId }, { session });
    if (!site || !doc) return { ok: false as const, error: "That reservation no longer exists." };
    const course = await c.courses.findOne({ _id: doc.courseId }, { session, projection: { title: 1 } });
    let enrollment = fromDoc<Enrollment>(doc);
    const changed = (enrollment.status === "paid") !== input.paid;
    if (changed) {
      const update = input.paid
        ? { $set: { status: "paid" as const, paidAt: new Date().toISOString(), paidBy: input.actor.id } }
        : { $set: { status: "pending_payment" as const }, $unset: { paidAt: "" as const, paidBy: "" as const } };
      const after = await c.enrollments.findOneAndUpdate({ _id: doc._id }, update, { session, returnDocument: "after" });
      enrollment = fromDoc<Enrollment>(after!);
      await recordAudit(tx, { id: input.siteId }, input.actor, input.paid ? "payment" : "payment_revoke", `${input.paid ? "Confirmed payment from" : "Revoked access for"} ${enrollment.email} · ${course?.title ?? "deleted course"}`);
    }
    return { ok: true as const, changed, enrollment, courseTitle: course?.title ?? "your course", siteName: site.name };
  });
}
