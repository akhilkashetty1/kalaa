import "server-only";
import type { Course, Enrollment, Learner } from "@/lib/types";
import { db, fromDoc } from "@/server/db";

export type StudentCourse = { courseId: string; title: string; status: "paid" | "pending"; done: number; total: number };
export type StudentRow = {
  email: string;
  name: string;
  phone?: string;
  status: "paid" | "waiting" | "browsing";
  courses: StudentCourse[];
  lastActive: string;
};

/**
 * Everyone who has signed in to a site or reserved a seat, one row per email address.
 * "Browsing" means they signed in but haven't reserved anything. Progress counts only lessons that still exist.
 */
export async function studentsOf(siteId: string) {
  const c = await db();
  const [courseDocs, learnerDocs, enrollmentDocs, progressDocs, sessionDocs] = await Promise.all([
    c.courses.find({ siteId }).toArray(),
    c.learners.find({ siteId }).toArray(),
    c.enrollments.find({ siteId }).toArray(),
    c.progress.find({ siteId }).toArray(),
    c.learnerSessions.find({ siteId }, { projection: { learnerId: 1, createdAt: 1 } }).toArray(),
  ]);
  const courses = courseDocs.map((d) => fromDoc<Course>(d));
  const byCourse = new Map(courses.map((c) => [c.id, c]));
  const learners = new Map(learnerDocs.map((d) => fromDoc<Learner>(d)).map((l) => [l.email, l]));
  const enrollments = enrollmentDocs.map((d) => fromDoc<Enrollment>(d));
  const emails = new Set([...learners.keys(), ...enrollments.map((e) => e.email)]);
  const latest = (a: string, b: string) => (a > b ? a : b);

  const rows: StudentRow[] = [...emails].map((email) => {
    const learner = learners.get(email);
    const mine = enrollments.filter((e) => e.email === email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const progress = learner ? progressDocs.filter((p) => p.learnerId === learner.id) : [];
    const sessions = learner ? sessionDocs.filter((x) => x.learnerId === learner.id).map((x) => ({ createdAt: x.createdAt.toISOString() })) : [];

    // One entry per course; a paid reservation wins over an older pending one.
    const perCourse = new Map<string, StudentCourse>();
    for (const e of mine) {
      const course = byCourse.get(e.courseId);
      if (!course) continue;
      const have = perCourse.get(course.id);
      if (have?.status === "paid") continue;
      const keys = new Set(progress.find((p) => p.courseId === course.id)?.completed ?? []);
      perCourse.set(course.id, { courseId: course.id, title: course.title, status: e.status === "paid" ? "paid" : "pending", done: course.lessons.filter((l) => keys.has(lessonKeyOf(l.title))).length, total: course.lessons.length });
    }
    const list = [...perCourse.values()];

    let lastActive = learner?.createdAt ?? "";
    for (const e of mine) lastActive = latest(lastActive, e.paidAt ?? e.createdAt);
    for (const p of progress) lastActive = latest(lastActive, p.updatedAt);
    for (const x of sessions) lastActive = latest(lastActive, x.createdAt);

    return {
      email,
      name: learner?.name || mine[0]?.name || email.split("@")[0],
      phone: mine[0]?.phone,
      status: list.some((c) => c.status === "paid") ? "paid" : list.length ? "waiting" : "browsing",
      courses: list.sort((a, b) => Number(b.status === "paid") - Number(a.status === "paid") || a.title.localeCompare(b.title)),
      lastActive,
    };
  });

  rows.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
  return { rows, courses: courses.map((c) => ({ id: c.id, title: c.title, paid: enrollments.filter((e) => e.courseId === c.id && e.status === "paid").length })) };
}

const lessonKeyOf = (title: string) => title.trim().toLowerCase().slice(0, 120);

