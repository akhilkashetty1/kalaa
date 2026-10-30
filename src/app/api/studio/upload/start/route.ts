import { randomUUID } from "node:crypto";
import { authorizeClientUpload, precheck } from "@/server/files";
import { blobStore, fileKey } from "@/server/storage";
import { withUploadAccess } from "@/server/upload-guard";

// Step 0 of every upload: checks the name, size and storage quota before any bytes move, and tells the
// browser how to send the file. With Vercel Blob it also picks the object key the upload token will allow.
export async function POST(req: Request) {
  return withUploadAccess(req, async (ctx) => {
    const body = (await req.json().catch(() => ({}))) as { name?: unknown; size?: unknown };
    const payload = { name: String(body.name ?? ""), size: Number(body.size) || 0 };
    if (blobStore().kind === "local") {
      await precheck(ctx.site.id, payload.name, payload.size);
      return Response.json({ mode: "server" });
    }
    const key = fileKey(ctx.site.id, randomUUID());
    await authorizeClientUpload(ctx.site.id, key, payload);
    return Response.json({ mode: "direct", key });
  });
}
