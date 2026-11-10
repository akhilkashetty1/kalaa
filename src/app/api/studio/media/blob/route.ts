import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeMediaUpload } from "@/server/media";
import { withUploadAccess } from "@/server/upload-guard";

// Issues the short-lived token the browser uses to upload one image straight to the private Blob store.
export async function POST(req: Request) {
  return withUploadAccess(
    req,
    async (ctx) => {
      const body = (await req.json()) as HandleUploadBody;
      const result = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          const payload = JSON.parse(clientPayload ?? "{}") as { name?: unknown; size?: unknown };
          return authorizeMediaUpload(ctx.site.id, pathname, { name: String(payload.name ?? ""), size: Number(payload.size) || 0 });
        },
      });
      return Response.json(result);
    },
    "brand.manage",
  );
}
