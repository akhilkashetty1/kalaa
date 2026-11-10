import { newMediaKey, precheckMedia } from "@/server/media";
import { blobStore } from "@/server/storage";
import { withUploadAccess } from "@/server/upload-guard";

// Step 0 of every image upload: checks the name, size and quota, then says how to send the bytes.
export async function POST(req: Request) {
  return withUploadAccess(
    req,
    async (ctx) => {
      const body = (await req.json().catch(() => ({}))) as { name?: unknown; size?: unknown };
      const payload = { name: String(body.name ?? ""), size: Number(body.size) || 0 };
      if (blobStore().kind === "local") {
        await precheckMedia(ctx.site.id, payload.name, payload.size);
        return Response.json({ mode: "server" });
      }
      return Response.json({ mode: "direct", key: await newMediaKey(ctx.site.id, payload) });
    },
    "brand.manage",
  );
}
