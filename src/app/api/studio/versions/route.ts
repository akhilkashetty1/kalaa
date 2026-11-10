import { listSchedules, listVersions } from "@/server/publish";
import { withUploadAccess } from "@/server/upload-guard";

// The site's published versions and pending scheduled publishes, for the editor's History panel.
export async function GET(req: Request) {
  return withUploadAccess(
    req,
    async (ctx) => {
      const [versions, schedules] = await Promise.all([listVersions(ctx.site.id), listSchedules(ctx.site.id)]);
      return Response.json({ versions, schedules }, { headers: { "Cache-Control": "private, no-store" } });
    },
    "brand.manage",
  );
}
