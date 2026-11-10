import { getVersion } from "@/server/publish";
import { withUploadAccess } from "@/server/upload-guard";

// One kept version's content, so the editor can load it as a draft.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withUploadAccess(
    req,
    async (ctx) => {
      if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Not found." }, { status: 404 });
      const version = await getVersion(ctx.site.id, id);
      return version ? Response.json({ snapshot: version.snapshot }, { headers: { "Cache-Control": "private, no-store" } }) : Response.json({ error: "Not found." }, { status: 404 });
    },
    "brand.manage",
  );
}
