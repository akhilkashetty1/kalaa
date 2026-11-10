import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SitePopup } from "@/components/site-popup";
import { SiteProvider } from "@/components/site-context";
import { LearnerSignOut } from "@/components/learner-signout";
import { SiteFooter, SiteNav, ThemeScope } from "@/components/storefront";
import { taglineOf } from "@/lib/blocks";
import { chromeFor } from "@/lib/chrome";
import { loadPublicData } from "@/server/data";
import { currentLearner } from "@/server/learner-auth";
import { t } from "@/lib/i18n";
import { paletteOf } from "@/lib/theme";
import { publicHost, publicSite, siteFromParam, siteOrigin } from "@/server/tenant";

type Props = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await siteFromParam((await params).site);
  const headline = taglineOf(site);
  const { brand } = chromeFor(site);
  return {
    // Image paths are relative ("/api/media/<id>"); this makes them absolute on the site's own address.
    metadataBase: new URL(siteOrigin(site)),
    title: { default: `${site.name} · ${headline}`, template: `%s · ${site.name}` },
    description: site.bio,
    ...(brand.favicon ? { icons: { icon: brand.favicon, apple: brand.favicon } } : {}),
    openGraph: { title: site.name, description: headline, siteName: site.name, type: "website", ...(brand.share ? { images: [{ url: brand.share }] } : {}) },
    twitter: { card: brand.share ? "summary_large_image" : "summary", ...(brand.share ? { images: [brand.share] } : {}) },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const site = await siteFromParam((await params).site);
  return { themeColor: paletteOf(site.theme).bg };
}

export default async function SiteLayout({ params, children }: Props & { children: React.ReactNode }) {
  const site = await siteFromParam((await params).site);
  const [learner, { courses, facts }] = await Promise.all([currentLearner(site.id), loadPublicData(site.id)]);
  const { analytics, popup } = chromeFor(site);
  return (
    <SiteProvider value={{ site: publicSite(site), courses, facts, editor: null }}>
      {/* Tracking runs only on the live site, and only with an ID that passed validation (lib/chrome.ts). */}
      {analytics.ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${analytics.ga}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${analytics.ga}');`}</Script>
        </>
      )}
      {analytics.meta && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${analytics.meta}');fbq('track','PageView');`}</Script>
      )}
      <ThemeScope theme={site.theme} className="site-root">
        <SiteNav site={site} learner={learner} signOut={learner ? <LearnerSignOut label={t(site.theme.lang).signOut} /> : null} />
        {children}
        <SiteFooter site={site} host={publicHost(site)} />
        {popup.enabled && <SitePopup popup={popup} siteId={site.id} />}
      </ThemeScope>
    </SiteProvider>
  );
}
