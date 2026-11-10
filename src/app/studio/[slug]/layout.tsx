import Link from "next/link";
import { AccountChip } from "@/components/account-chip";
import { StudioNavLink } from "@/components/studio-ui";
import { requireSiteAccess } from "@/server/auth";
import { leadCounts } from "@/server/leads";
import { customDomainOrigin, subdomainOrigin } from "@/lib/config";
import { ROLE_META, can } from "@/lib/roles";
import { onAccent } from "@/lib/theme";

export default async function StudioSiteLayout({ params, children }: { params: Promise<{ slug: string }>; children: React.ReactNode }) {
  const { slug } = await params;
  const { site, creator, role } = await requireSiteAccess(slug);
  const base = `/studio/${slug}`;
  const newLeads = can(role, "reservations.view") ? (await leadCounts(site.id)).new : 0;
  const live = site.domain?.status === "active" ? customDomainOrigin(site.domain.hostname) : subdomainOrigin(site.slug);
  const initials = site.creator.name.split(" ").map((w) => w[0]).join("").slice(0, 2);

  return (
    <div className="shell">
      <div className="wrap">
        <header className="topbar">
          <Link href="/" className="logo"><i>क</i>Kalaa</Link>
          <span className="pill gold">Studio</span>
          <span className="spacer" />
          <Link className="btn sm" href="/studio">All sites</Link>
          <a className="btn sm" href={live} target="_blank" rel="noopener">View site ↗</a>
          <AccountChip creator={creator} role={ROLE_META[role].label} />
        </header>
        <div className="studio">
          <nav className="panel side" aria-label="Studio">
            <div className="who">
              <div className="av" style={{ background: site.theme.accent, color: onAccent(site.theme.accent) }}>{initials}</div>
              <div style={{ minWidth: 0 }}><b>{site.creator.name}</b><span>{site.name}</span></div>
            </div>
            <StudioNavLink href={base} exact>Overview</StudioNavLink>
            {can(role, "brand.manage") && <StudioNavLink href={`/editor/${slug}`}>Site editor ↗</StudioNavLink>}
            {can(role, "courses.manage") && <StudioNavLink href={`${base}/courses`}>Courses</StudioNavLink>}
            {can(role, "reservations.view") && <StudioNavLink href={`${base}/students`}>Students</StudioNavLink>}
            {can(role, "reservations.view") && <StudioNavLink href={`${base}/reservations`}>Reservations</StudioNavLink>}
            {can(role, "reservations.view") && <StudioNavLink href={`${base}/leads`}>Leads{newLeads > 0 && <span className="pill gold" style={{ marginLeft: 8 }}>{newLeads}</span>}</StudioNavLink>}
            {can(role, "domain.manage") && <StudioNavLink href={`${base}/domain`}>Domain</StudioNavLink>}
            <StudioNavLink href={`${base}/team`}>Team</StudioNavLink>
            {can(role, "payments.confirm") && <StudioNavLink href={`${base}/settings`}>Settings</StudioNavLink>}
          </nav>
          <div className="ws">{children}</div>
        </div>
      </div>
    </div>
  );
}
