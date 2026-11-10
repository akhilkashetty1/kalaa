import { timingSafeEqual } from "node:crypto";
import { applyDueSchedules } from "@/server/publish";

// Publishes every scheduled publish that is due. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`
// (set CRON_SECRET in the project's environment variables). In production the secret is required; locally,
// with no secret set, anyone on this machine may call it, which is how you try it:
//   curl http://localhost:3000/api/cron/publish
// Teammates opening the editor also publish what is due for their site, so a missed run is never a long delay.

export const dynamic = "force-dynamic";

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production" && !process.env.VERCEL;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function GET(req: Request) {
  if (!authorised(req)) return new Response("Unauthorized", { status: 401 });
  return Response.json({ published: await applyDueSchedules() }, { headers: { "Cache-Control": "no-store" } });
}
