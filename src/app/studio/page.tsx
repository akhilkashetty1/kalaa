import Link from "next/link";
import { AccountChip } from "@/components/account-chip";
import { ActionForm } from "@/components/studio-ui";
import { requireCreator } from "@/server/auth";
import { ROOT_DOMAIN } from "@/lib/config";
import { listSitesFor } from "@/server/data";
import { ROLE_META } from "@/lib/roles";
import { PRESETS } from "@/lib/theme";
import { publicHost } from "@/server/tenant";
import { TEMPLATES, isTemplateId } from "@/lib/templates";
import { createSite } from "./actions";

export const metadata = { title: "Studio · Kalaa" };

export default async function StudioHome({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  const pick = (await searchParams).industry;
  const industry = isTemplateId(pick) ? pick : "exam";
  const creator = await requireCreator();
  const sites = await listSitesFor(creator.id);
  return (
    <div className="shell">
      <div className="wrap">
        <header className="topbar">
          <Link href="/" className="logo"><i>क</i>Kalaa</Link>
          <span className="pill gold">Studio</span>
          <span className="spacer" />
          <AccountChip creator={creator} />
        </header>

        <div className="ws">
          <div className="ws-head"><div><div className="eyebrow">Your sites</div><h1>{sites.length ? "Pick a site to work on" : `Welcome, ${creator.name.split(" ")[0]}`}</h1></div></div>

          {sites.length > 0 && <div className="site-list" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {sites.map(({ site: s, role }) => {
              const p = PRESETS[s.theme.preset];
              return (
                <Link key={s.id} className="panel site-card" href={`/studio/${s.slug}`}>
                  <span className="sw" style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${s.theme.accent} 50%)` }} />
                  <div style={{ minWidth: 0 }}>
                    <b>{s.name}</b>
                    <span>{publicHost(s)}</span>
                  </div>
                  <span className="pill" style={{ marginLeft: "auto" }}>{ROLE_META[role].label}</span>
                  <span className="go">→</span>
                </Link>
              );
            })}
          </div>}

          {/* With no site yet, the form is the page. With sites, it's tucked away so the dashboard list comes first. */}
          <details className="panel new-site" open={sites.length === 0} style={{ maxWidth: 720 }}>
            <summary className="card-h"><h2>{sites.length ? "Start another site" : "Start a new site"}</h2><span className="mono muted">Free on {ROOT_DOMAIN}</span></summary>
            <div className="card-b">
              <ActionForm action={createSite} submit="Create site" className="form-grid">
                <div className="field"><label htmlFor="name">Brand name</label><input className="input" id="name" name="name" placeholder="The Chemistry Lab" required /></div>
                <div className="field"><label htmlFor="creator">Teacher&apos;s name</label><input className="input" id="creator" name="creator" placeholder="Priya Nair" required /></div>
                <div className="field full">
                  <label htmlFor="industry">What do you teach?</label>
                  <select className="input" id="industry" name="industry" defaultValue={industry}>
                    {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}: {t.who}</option>)}
                  </select>
                  <span className="hint">This picks a starting page and look written for your kind of teaching. You can change everything later.</span>
                </div>
                <div className="field full">
                  <label htmlFor="slug">Free address</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input className="input" id="slug" name="slug" placeholder="chemlab" pattern="[a-z0-9-]{3,32}" required style={{ maxWidth: 240 }} />
                    <span className="mono muted">.{ROOT_DOMAIN}</span>
                  </div>
                  <span className="hint">You can connect your own domain later.</span>
                </div>
              </ActionForm>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
