import { AccessError, assertSiteAccess } from "@/server/auth";
import { csvCell as cell, csvResponse } from "@/server/csv";
import { studentsOf } from "@/server/data";

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
  return csvResponse(lines, `students-${ctx.site.slug}.csv`);
}
