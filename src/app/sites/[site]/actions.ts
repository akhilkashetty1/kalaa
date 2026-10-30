"use server";

import { createEnrollment, getCourse } from "@/server/data";
import { currentLearner } from "@/server/learner-auth";
import { siteFromParam } from "@/server/tenant";

export type ReserveState = {
  error?: "name" | "email" | "phone" | "course";
  reserved?: boolean;
  /** Echoed back so the form keeps what the learner typed (React resets forms after an action). */
  values?: { name: string; email: string; phone: string };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns state instead of redirecting: a server-action redirect is rendered without the
// middleware rewrite, so it would miss the /sites/[site] route on tenant hosts.

/** Reserves a seat. Payment collection (Razorpay) is the next phase; for now the creator follows up. */
export async function reserveSeat(siteParam: string, courseSlug: string, _: ReserveState, formData: FormData): Promise<ReserveState> {
  const site = await siteFromParam(siteParam);
  const course = await getCourse(site.id, courseSlug);
  if (!course || !course.published) return { error: "course" };

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  // A signed-in learner reserves under their verified address, whatever the form says, so access follows their account.
  const learner = await currentLearner(site.id);
  const email = learner ? learner.email : String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const phone = String(formData.get("phone") ?? "").replace(/[^\d+]/g, "").slice(0, 16);

  const values = { name, email, phone };
  if (!name) return { error: "name", values };
  if (!EMAIL.test(email)) return { error: "email", values };
  if (phone.replace(/\D/g, "").length < 10) return { error: "phone", values };

  await createEnrollment({ siteId: site.id, courseId: course.id, name, email, phone });
  return { reserved: true };
}
