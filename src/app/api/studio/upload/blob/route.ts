import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authorizeClientUpload } from "@/server/files";
import { withUploadAccess } from "@/server/upload-guard";

// Issues the short-lived token the browser uses to upload one file straight to the private Blob store.
// The token is bound to the key from ./start, this site's folder, and the size limit.
export async function POST(req: Request) {
  return withUploadAccess(req, async (ctx) => {
    const body = (await req.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload ?? "{}") as { name?: unknown; size?: unknown };
        return authorizeClientUpload(ctx.site.id, pathname, { name: String(payload.name ?? ""), size: Number(payload.size) || 0 });
      },
    });
    return Response.json(result);
  });
}
