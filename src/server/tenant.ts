import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ROOT_DOMAIN, customDomainOrigin, subdomainOrigin } from "@/lib/config";
import { getSiteByHost } from "@/server/data/sites";
import type { PublicSite } from "@/components/site-context";
import type { Site } from "@/lib/types";

/** The [site] route param is the request host, URL-encoded by middleware. */
export const siteFromParam = cache(async (param: string): Promise<Site> => {
  const site = await getSiteByHost(decodeURIComponent(param));
  if (!site) notFound();
  return site;
});

/** The address learners see: the custom domain once active, otherwise the free subdomain. */
export function publicHost(site: Site) {
  return site.domain?.status === "active" ? site.domain.hostname : `${site.slug}.${ROOT_DOMAIN}`;
}

/** The site for the request's own Host header. Server actions use this instead of trusting an argument from the page. */
export async function siteFromHost(): Promise<Site> {
  const site = await getSiteByHost(((await headers()).get("host") ?? "").toLowerCase());
  if (!site) throw new Error("Unknown site");
  return site;
}

/** Where learners reach the storefront: the custom domain once active, otherwise the free address. */
export function siteOrigin(site: Site) {
  return site.domain?.status === "active" ? customDomainOrigin(site.domain.hostname) : subdomainOrigin(site.slug);
}

/** The slice of a site that blocks need on the client. Leaves out owner ids and domain state. */
export const publicSite = (s: Site): PublicSite => ({ name: s.name, slug: s.slug, creator: s.creator, theme: s.theme });
