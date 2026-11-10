import { finishMediaUpload } from "@/server/media";
import { withUploadAccess } from "@/server/upload-guard";

// The last step of a direct image upload: checks what actually landed in storage and records it.
export async function POST(req: Request) {
  return withUploadAccess(
    req,
    async (ctx) => {
      const body = (await req.json().catch(() => ({}))) as { key?: unknown; name?: unknown };
      return Response.json(await finishMediaUpload({ siteId: ctx.site.id, uploadedBy: ctx.creator.id, key: String(body.key ?? ""), name: String(body.name ?? "") }));
    },
    "brand.manage",
  );
}
