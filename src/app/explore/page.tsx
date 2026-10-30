import Link from "next/link";
import { LandingFooter, LandingNav } from "@/components/landing-nav";
import { inr } from "@/lib/i18n";
import { listPublicSites } from "@/server/data";
import { TEMPLATES, templateName } from "@/lib/templates";
import { siteOrigin } from "@/server/tenant";
import { PRESETS } from "@/lib/theme";

export const metadata = { title: "Explore teachers · Kalaa", description: "Find teachers and courses on Kalaa." };

export default async function Explore({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const { c, q } = await searchParams;
  const term = (q ?? "").trim().toLowerCase().slice(0, 60);
  const all = await listPublicSites();
  const shown = all.filter(({ site, courses }) => (!c || site.category === c) && (!term || [site.name, site.creator.name, ...courses.map((x) => x.title)].some((t) => t.toLowerCase().includes(term))));
  const present = new Set(all.map((x) => x.site.category));

  return (
    <div className="mk">
      <LandingNav />
      <section className="mk-sec mk-explore">
        <p className="eyebrow">Explore</p>
        <h1>Find your <em>teacher</em>.</h1>
        <p className="mk-lede">Teachers on Kalaa, and the courses they run. You'll sign in on the teacher's own page.</p>
        <form className="mk-search" action="/explore" method="get">
          {c && <input type="hidden" name="c" value={c} />}
          <input className="input" name="q" defaultValue={q} placeholder="Search a teacher or a course" aria-label="Search" />
          <button className="btn gold" type="submit">Search</button>
        </form>
        <div className="mk-chips" role="navigation" aria-label="Categories">
          <Link href="/explore" aria-current={!c ? "true" : undefined}>All</Link>
          {TEMPLATES.filter((t) => present.has(t.id)).map((t) => <Link key={t.id} href={`/explore?c=${t.id}`} aria-current={c === t.id ? "true" : undefined}>{t.name}</Link>)}
        </div>

        {shown.length ? (
          <div className="mk-demos">
            {shown.map(({ site, courses }) => {
              const pre = PRESETS[site.theme.preset];
              const from = Math.min(...courses.map((x) => x.priceInr));
              return (
                <a key={site.id} className="mk-demo big" href={siteOrigin(site)} style={{ background: pre.bg, color: pre.ink }}>
                  <i style={{ background: site.theme.accent }} />
                  <small style={{ color: pre.muted }}>{templateName(site.category)}</small>
                  <b>{site.name}</b>
                  <span style={{ color: pre.muted }}>{site.creator.name}</span>
                  <ul>{courses.slice(0, 3).map((x) => <li key={x.id}>{x.title}</li>)}</ul>
                  <em style={{ color: site.theme.accent }}>{courses.length} {courses.length === 1 ? "course" : "courses"} · from {inr(from)} →</em>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="mk-empty">No teachers match that yet. <Link href="/explore">See everyone</Link>.</p>
        )}
        <p className="mk-more">Teach something? <Link href="/login?next=/studio">List your classes on Kalaa →</Link></p>
      </section>
      <LandingFooter />
    </div>
  );
}
