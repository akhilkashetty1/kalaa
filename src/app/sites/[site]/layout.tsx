import type { Metadata, Viewport } from "next";
import { SiteProvider } from "@/components/site-context";
import { LearnerSignOut } from "@/components/learner-signout";
import { SiteFooter, SiteNav, ThemeScope } from "@/components/storefront";
import { taglineOf } from "@/lib/blocks";
import { listCourses } from "@/server/data";
import { currentLearner } from "@/server/learner-auth";
import { t } from "@/lib/i18n";
import { paletteOf } from "@/lib/theme";
import { publicHost, publicSite, siteFromParam } from "@/server/tenant";

type Props = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await siteFromParam((await params).site);
  const headline = taglineOf(site);
  return {
    title: { default: `${site.name} · ${headline}`, template: `%s · ${site.name}` },
    description: site.bio,
    openGraph: { title: site.name, description: headline, siteName: site.name, type: "website" },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const site = await siteFromParam((await params).site);
  return { themeColor: paletteOf(site.theme).bg };
}

export default async function SiteLayout({ params, children }: Props & { children: React.ReactNode }) {
  const site = await siteFromParam((await params).site);
  const [learner, courses] = await Promise.all([currentLearner(site.id), listCourses(site.id, { publishedOnly: true })]);
  return (
    <SiteProvider value={{ site: publicSite(site), courses, editor: null }}>
      <ThemeScope theme={site.theme} className="site-root">
        <SiteNav site={site} learner={learner} signOut={learner ? <LearnerSignOut label={t(site.theme.lang).signOut} /> : null} />
        {children}
        <SiteFooter site={site} host={publicHost(site)} />
      </ThemeScope>
    </SiteProvider>
  );
}
