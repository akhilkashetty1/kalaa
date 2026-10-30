import { AccessError, assertSiteAccess } from "@/server/auth";
import { fileResponse, readStored } from "@/server/files";

// Lets a teammate open a file they attached, to check it. Learners use the storefront's own /files route.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  let ctx;
  try {
    ctx = await assertSiteAccess(url.searchParams.get("site") ?? "", "courses.manage");
  } catch (err) {
    if (err instanceof AccessError) return new Response("Not found", { status: 404 });
    throw err;
  }
  const stored = await readStored(ctx.site.id, (await params).id);
  return stored ? fileResponse(stored.meta, stored.object, url.searchParams.get("download") === "1") : new Response("Not found", { status: 404 });
}
