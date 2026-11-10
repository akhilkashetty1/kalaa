import { deleteSavedSection } from "@/server/sections";
import { withUploadAccess } from "@/server/upload-guard";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withUploadAccess(
    req,
    async (ctx) => {
      if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Not found." }, { status: 404 });
      return (await deleteSavedSection(ctx.site.id, id)) ? Response.json({ ok: true }) : Response.json({ error: "Not found." }, { status: 404 });
    },
    "brand.manage",
  );
}
