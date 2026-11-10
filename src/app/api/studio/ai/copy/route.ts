import { aiEnabled, AiError, draftCopy } from "@/server/ai";
import { withUploadAccess } from "@/server/upload-guard";

// Drafts website copy from a teacher's description. Returns validated copy only; the editor merges it into
// the page as an unpublished draft.
export async function POST(req: Request) {
  return withUploadAccess(
    req,
    async (ctx) => {
      if (!aiEnabled()) return Response.json({ error: "AI drafts aren't set up on this server." }, { status: 501 });
      const body = (await req.json().catch(() => ({}))) as { description?: unknown; language?: unknown };
      try {
        const copy = await draftCopy({ siteId: ctx.site.id, siteName: ctx.site.name, teacher: ctx.site.creator.name, description: String(body.description ?? ""), language: body.language === "hi" ? "hi" : "en" });
        return Response.json({ copy }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (err) {
        if (err instanceof AiError) return Response.json({ error: err.message }, { status: 400 });
        throw err;
      }
    },
    "brand.manage",
  );
}
