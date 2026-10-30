import { NoAccess } from "@/components/no-access";
import { SiteEditor } from "@/components/site-editor";
import { requireSiteAccess } from "@/server/auth";
import { blocksFor } from "@/lib/blocks";
import { listCourses } from "@/server/data";
import { publicHost, siteOrigin } from "@/server/tenant";
import { publishSite } from "@/app/studio/actions";

export const metadata = { title: "Site editor · Kalaa", robots: { index: false } };

export default async function EditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { site, role, allowed } = await requireSiteAccess(slug, "brand.manage");
  if (!allowed) return <div className="shell"><div className="wrap" style={{ paddingTop: 48 }}><NoAccess role={role} slug={slug} what="The site editor" /></div></div>;
  const courses = await listCourses(site.id, { publishedOnly: true });
  return <SiteEditor slug={slug} site={site} courses={courses} host={publicHost(site)} liveUrl={siteOrigin(site)} initialBlocks={blocksFor(site)} publish={publishSite.bind(null, slug)} />;
}
