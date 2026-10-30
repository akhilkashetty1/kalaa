import { PageBlocks } from "@/components/blocks";
import { blocksFor } from "@/lib/blocks";
import { siteFromParam } from "@/server/tenant";

export default async function SiteHome({ params }: { params: Promise<{ site: string }> }) {
  const site = await siteFromParam((await params).site);
  return (
    <main>
      <PageBlocks blocks={blocksFor(site)} />
    </main>
  );
}
