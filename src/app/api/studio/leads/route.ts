import { AccessError, assertSiteAccess } from "@/server/auth";
import { csvCell as cell, csvResponse } from "@/server/csv";
import { listLeads } from "@/server/leads";

// The leads as a CSV. Owner and co-owner only: it is a bulk export of contact details.
export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await assertSiteAccess(new URL(req.url).searchParams.get("site") ?? "", "students.message");
  } catch (err) {
    if (err instanceof AccessError) return new Response("Not found", { status: 404 });
    throw err;
  }
  const leads = await listLeads(ctx.site.id);
  const lines = [["Date", "Name", "Email", "Phone", "Form", "Page", "Message", "Answers", "Consent given", "Status"].join(",")];
  for (const l of leads) {
    lines.push([l.createdAt, l.name, l.email, l.phone ?? "", l.form, l.source, l.message ?? "", l.answers.map((a) => `${a.label}: ${a.value}`).join("; "), l.consent ? "yes" : "", l.status].map(cell).join(","));
  }
  return csvResponse(lines, `leads-${ctx.site.slug}.csv`);
}
