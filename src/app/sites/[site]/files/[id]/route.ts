import { canDownload, fileResponse, readStored } from "@/server/files";
import { currentLearner } from "@/server/learner-auth";
import { getSiteByHost } from "@/server/data";

// A lesson attachment, for a student. Open to everyone on a free-preview lesson; otherwise only to a
// signed-in student whose payment for the course is confirmed. Every other case is a plain "not found".
export async function GET(req: Request, { params }: { params: Promise<{ site: string; id: string }> }) {
  const p = await params;
  const notFound = () => new Response("Not found", { status: 404 });
  if (!/^[0-9a-f-]{36}$/.test(p.id)) return notFound();
  const site = await getSiteByHost(decodeURIComponent(p.site));
  if (!site) return notFound();
  const learner = await currentLearner(site.id);
  if (!(await canDownload(site.id, p.id, learner?.email ?? null))) return notFound();
  const stored = await readStored(site.id, p.id);
  return stored ? fileResponse(stored.meta, stored.object, new URL(req.url).searchParams.get("download") === "1") : notFound();
}
