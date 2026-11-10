import { NoAccess } from "@/components/no-access";
import { SiteEditor } from "@/components/site-editor";
import { requireSiteAccess } from "@/server/auth";
import { blocksFor } from "@/lib/blocks";
import { chromeFor } from "@/lib/chrome";
import { sanitizeCourseTemplate } from "@/lib/pages";
import { getSiteBySlug, loadPublicData } from "@/server/data";
import { aiEnabled } from "@/server/ai";
import { applyDueSchedules } from "@/server/publish";
import { publicHost, siteOrigin } from "@/server/tenant";
import { cancelScheduledPublish, publishSite, schedulePublish } from "@/app/studio/actions";

export const metadata = { title: "Site editor · Kalaa", robots: { index: false } };

export default async function EditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireSiteAccess(slug, "brand.manage");
  const { role, allowed } = access;
  // Anything scheduled that is already due goes live now, even if the cron job hasn't run yet.
  const site = access.allowed && (await applyDueSchedules(access.site.id)) > 0 ? ((await getSiteBySlug(slug)) ?? access.site) : access.site;
  if (!allowed) return <div className="shell"><div className="wrap" style={{ paddingTop: 48 }}><NoAccess role={role} slug={slug} what="The site editor" /></div></div>;
  const { courses, facts } = await loadPublicData(site.id);
  return <SiteEditor slug={slug} site={site} courses={courses} facts={facts} host={publicHost(site)} liveUrl={siteOrigin(site)} initialBlocks={blocksFor(site)} initialChrome={chromeFor(site)} initialPages={site.pages ?? []} initialCourseTemplate={sanitizeCourseTemplate(site.courseTemplate)} publish={publishSite.bind(null, slug)} schedule={schedulePublish.bind(null, slug)} cancelSchedule={cancelScheduledPublish.bind(null, slug)} aiEnabled={aiEnabled()} />;
}
