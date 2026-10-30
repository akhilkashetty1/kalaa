import { redirect } from "next/navigation";
import { requireSiteAccess } from "@/server/auth";

// The brand studio is now the full-screen site editor.
export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireSiteAccess(slug, "brand.manage");
  redirect(`/editor/${slug}`);
}
