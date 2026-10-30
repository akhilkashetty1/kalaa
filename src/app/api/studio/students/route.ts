import { AccessError, assertSiteAccess } from "@/server/auth";
import { studentsOf } from "@/server/data";

/** A spreadsheet can run a cell that starts with = + - @ as a formula, so those get a leading quote. */
const cell = (v: string) => {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// The student list as a CSV. Owner and co-owner only: it is a bulk export of contact details.
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await assertSiteAccess(new URL(req.url).searchParams.get("site") ?? "", "students.message");
  } catch (err) {
    if (err instanceof AccessError) return new Response("Not found", { status: 404 });
    throw err;
  }
  const { rows } = await studentsOf(ctx.site.id);
  const lines = [["Name", "Email", "Phone", "Status", "Courses", "Last active"].join(",")];
  for (const r of rows) {
    const courses = r.courses.map((c) => `${c.title} (${c.status === "paid" ? `paid, ${c.done}/${c.total} lessons` : "waiting for payment"})`).join("; ");
    lines.push([r.name, r.email, r.phone ?? "", r.status, courses, r.lastActive].map(cell).join(","));
  }
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="students-${ctx.site.slug}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
