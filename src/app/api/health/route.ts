import { db } from "@/server/db";

// Liveness and database check for uptime monitors. Reveals nothing beyond up or down.
export async function GET() {
  try {
    const c = await db();
    await c.migrations.estimatedDocumentCount();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
