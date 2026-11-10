import { ImageResponse } from "next/og";
import { paletteOf } from "@/lib/theme";
import { siteFromParam } from "@/server/tenant";

// Home-screen icon: the school's first letter on its accent colour. Generated, so every school has a valid
// 192 and 512 px PNG even before it uploads a logo. The letter sits inside the maskable safe zone.
export async function GET(_req: Request, { params }: { params: Promise<{ site: string; size: string }> }) {
  const p = await params;
  const size = p.size === "192" ? 192 : p.size === "512" ? 512 : 0;
  if (!size) return new Response("Not found", { status: 404 });
  const site = await siteFromParam(p.site);
  const letter = ([...site.name.trim()][0] ?? "K").toUpperCase();
  const { bg } = paletteOf(site.theme);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: site.theme.accent, color: bg, fontSize: size * 0.5, fontWeight: 800 }}>{letter}</div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
