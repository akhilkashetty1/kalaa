import { MAX_MEDIA_BYTES } from "@/lib/media";
import { MediaError, listMedia, saveMediaUpload } from "@/server/media";
import { blobStore } from "@/server/storage";
import { withUploadAccess } from "@/server/upload-guard";

const PERMISSION = "brand.manage";

// The site's media library, for the editor: GET lists it, POST uploads one image through our own server
// (local storage only; with Vercel Blob the browser uploads straight to the store, see ./start).
export async function GET(req: Request) {
  return withUploadAccess(req, async (ctx) => Response.json(await listMedia(ctx.site.id), { headers: { "Cache-Control": "private, no-store" } }), PERMISSION);
}

export async function POST(req: Request) {
  return withUploadAccess(
    req,
    async (ctx) => {
      if (blobStore().kind !== "local") throw new MediaError("Uploads go straight to storage here. Reload the page and try again.");
      const declared = Number(req.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > MAX_MEDIA_BYTES + 1024 * 1024) return Response.json({ error: "That image is too big." }, { status: 413 });
      const form = await req.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File)) return Response.json({ error: "No file was sent." }, { status: 400 });
      return Response.json(await saveMediaUpload({ siteId: ctx.site.id, uploadedBy: ctx.creator.id, file }));
    },
    PERMISSION,
  );
}
