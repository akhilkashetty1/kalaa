import { listSavedSections, saveSection } from "@/server/sections";
import { withUploadAccess } from "@/server/upload-guard";

// The site's saved custom sections: GET lists them, POST saves the one the editor sends.
export async function GET(req: Request) {
  return withUploadAccess(req, async (ctx) => Response.json({ items: await listSavedSections(ctx.site.id) }, { headers: { "Cache-Control": "private, no-store" } }), "brand.manage");
}

export async function POST(req: Request) {
  return withUploadAccess(
    req,
    async (ctx) => {
      const body = (await req.json().catch(() => ({}))) as { name?: unknown; props?: unknown };
      return Response.json(await saveSection({ siteId: ctx.site.id, createdBy: ctx.creator.id, name: String(body.name ?? ""), props: body.props }));
    },
    "brand.manage",
  );
}
