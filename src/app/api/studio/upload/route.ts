import { MAX_FILE_BYTES, UploadError, saveUpload } from "@/server/files";
import { blobStore } from "@/server/storage";
import { withUploadAccess } from "@/server/upload-guard";

// Lesson attachment upload through our own server, for local storage. With Vercel Blob the browser
// uploads straight to the store instead (see ./start, ./blob and ./complete).
export async function POST(req: Request) {
  return withUploadAccess(req, async (ctx) => {
    if (blobStore().kind !== "local") throw new UploadError("Uploads go straight to storage here. Reload the page and try again.");
    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_FILE_BYTES + 1024 * 1024) return Response.json({ error: `That file is too big. The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.` }, { status: 413 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return Response.json({ error: "No file was sent." }, { status: 400 });
    return Response.json(await saveUpload({ siteId: ctx.site.id, uploadedBy: ctx.creator.id, file }));
  });
}
