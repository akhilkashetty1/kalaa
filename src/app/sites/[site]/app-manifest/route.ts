import { chromeFor } from "@/lib/chrome";
import { paletteOf } from "@/lib/theme";
import { siteFromParam } from "@/server/tenant";

// The web app manifest: lets a learner add this school to their home screen as an app that opens full-screen
// on the library. Name, colours and icon come from the same settings as the website.
export async function GET(_req: Request, { params }: { params: Promise<{ site: string }> }) {
  const site = await siteFromParam((await params).site);
  const pal = paletteOf(site.theme);
  const name = site.name.slice(0, 45);
  return Response.json(
    {
      name,
      short_name: name.length > 12 ? name.slice(0, 12).trim() : name,
      description: site.bio.slice(0, 200),
      start_url: "/my-courses",
      scope: "/",
      display: "standalone",
      background_color: pal.bg,
      theme_color: pal.bg,
      icons: [
        { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=300" } },
  );
}
