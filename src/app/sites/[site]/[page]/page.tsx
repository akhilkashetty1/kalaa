import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBlocks } from "@/components/blocks";
import { siteFromParam } from "@/server/tenant";

// An extra page of a storefront, served at /<slug>. Fixed routes (login, courses, ...) win over this one,
// and the editor never lets a page take those addresses.

type Props = { params: Promise<{ site: string; page: string }> };

async function load(params: Props["params"]) {
  const p = await params;
  const site = await siteFromParam(p.site);
  const page = site.pages?.find((x) => x.slug === p.page);
  if (!page) notFound();
  return { site, page };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, page } = await load(params);
  return { title: page.title, description: page.description || site.bio };
}

export default async function SitePage({ params }: Props) {
  const { page } = await load(params);
  return (
    <main>
      <PageBlocks blocks={page.blocks} />
    </main>
  );
}
