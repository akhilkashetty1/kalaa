import { chromeFor } from "@/lib/chrome";
import { taglineOf } from "@/lib/blocks";
import { appSite, fail, json } from "@/server/app-api";
import { loadPublicData } from "@/server/data";
import { publicHost, publicSite } from "@/server/tenant";

// Everything the app needs to dress itself as this teacher's school: name, look, brand kit and the
// public course list. Changing any of it in Studio changes the app the next time it opens, with no store release.
export async function GET() {
  const site = await appSite();
  if (!site) return fail(404, "Unknown school.");
  const { brand, nav, announcement } = chromeFor(site);
  const { courses, facts } = await loadPublicData(site.id);
  return json({
    ok: true,
    site: { ...publicSite(site), bio: site.bio, tagline: taglineOf(site), host: publicHost(site), lang: site.theme.lang },
    brand: { logo: brand.logo, logoDark: brand.logoDark, favicon: brand.favicon, showName: brand.showName },
    announcement: announcement.enabled ? { text: announcement.text, href: announcement.href } : null,
    nav: nav.showAccount,
    courses,
    facts,
  });
}
