import "server-only";
import { publicCourse, type PublicCourse } from "@/lib/types";
import type { Course } from "@/lib/types";
import { db, fromDoc } from "@/server/db";

// What a storefront shows every visitor: published courses (without lesson links), seats left, and a few
// counts. Nothing here identifies a person. Both the live site and the editor preview read it.

/** Numbers about the site, for elements like "1,240 students". Counts only. */
export type SiteFacts = { students: number; courses: number; lessons: number; hours: number };

export async function loadPublicData(siteId: string): Promise<{ courses: PublicCourse[]; facts: SiteFacts }> {
  const c = await db();
  const docs = await c.courses.find({ siteId, published: true }).sort({ createdAt: 1 }).toArray();
  const courses = docs.map((d) => fromDoc<Course>(d));

  // Every reservation, paid or not, holds a seat.
  const taken = new Map<string, number>();
  const seated = courses.filter((x) => x.seats !== undefined);
  if (seated.length) {
    const rows = await c.enrollments.aggregate<{ _id: string; n: number }>([{ $match: { siteId, courseId: { $in: seated.map((x) => x.id) } } }, { $group: { _id: "$courseId", n: { $sum: 1 } } }]).toArray();
    for (const r of rows) taken.set(r._id, r.n);
  }

  const paidEmails = await c.enrollments.distinct("email", { siteId, status: "paid" });
  const minutes = courses.reduce((n, x) => n + x.lessons.reduce((m, l) => m + l.minutes, 0), 0);
  return {
    courses: courses.map((x) => publicCourse(x, x.seats !== undefined ? Math.max(0, x.seats - (taken.get(x.id) ?? 0)) : undefined)),
    facts: { students: paidEmails.length, courses: courses.length, lessons: courses.reduce((n, x) => n + x.lessons.length, 0), hours: Math.round(minutes / 60) },
  };
}
