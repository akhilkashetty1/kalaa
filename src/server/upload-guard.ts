import "server-only";
import { AccessError, assertSiteAccess } from "@/server/auth";
import { UserError } from "@/server/errors";
import type { Permission } from "@/lib/roles";

// Shared by the upload and media routes: same-origin only, a signed-in teammate with the needed permission on the site,
// and errors the person can act on returned as JSON.

export async function withUploadAccess(req: Request, handle: (ctx: Awaited<ReturnType<typeof assertSiteAccess>>) => Promise<Response>, permission: Permission = "courses.manage") {
  // The session cookie is SameSite=Lax; this closes the remaining gap.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return Response.json({ error: "Not allowed from here." }, { status: 403 });
  let ctx;
  try {
    ctx = await assertSiteAccess(new URL(req.url).searchParams.get("site") ?? "", permission);
  } catch (err) {
    if (err instanceof AccessError) return Response.json({ error: err.message }, { status: 403 });
    throw err;
  }
  try {
    return await handle(ctx);
  } catch (err) {
    if (err instanceof UserError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
