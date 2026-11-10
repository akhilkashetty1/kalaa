import { deleteMedia, setMediaAlt } from "@/server/media";
import { withUploadAccess } from "@/server/upload-guard";

const ID = /^[0-9a-f-]{36}$/;

// Edit the description (alt text) of an image, or delete it.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withUploadAccess(
    req,
    async (ctx) => {
      if (!ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });
      const body = (await req.json().catch(() => ({}))) as { alt?: unknown };
      return (await setMediaAlt(ctx.site.id, id, String(body.alt ?? ""))) ? Response.json({ ok: true }) : Response.json({ error: "Not found." }, { status: 404 });
    },
    "brand.manage",
  );
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withUploadAccess(
    req,
    async (ctx) => {
      if (!ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });
      const res = await deleteMedia(ctx.site.id, id);
      return res.ok ? Response.json({ ok: true }) : Response.json({ error: res.error }, { status: 409 });
    },
    "brand.manage",
  );
}
