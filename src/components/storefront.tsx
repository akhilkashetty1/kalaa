import type { ReactNode } from "react";
import { blocksFor } from "@/lib/blocks";
import { SOCIAL_KINDS, chromeFor, headerLinks, isExternal, linkTarget, logoFor } from "@/lib/chrome";
import { t } from "@/lib/i18n";
import { themeVars, type Theme } from "@/lib/theme";
import type { Block, Course, Site, SiteChrome, SitePage } from "@/lib/types";
import { Ambient } from "./ambient";

// Storefront chrome: the themed frame, the nav and the footer. No hooks, so these render on the server
// for the live site and inside the client-side editor canvas alike.

type SiteProps = { site: Site; preview?: boolean };

/** Applies a theme's tokens, motion and ambient settings to everything inside it. */
export function ThemeScope({ theme, className = "", children }: { theme: Theme; className?: string; children: ReactNode }) {
  return (
    <div className={`brand sf ${className}`} style={themeVars(theme)} data-motion={theme.motion} data-glow={String(theme.glow)} data-grain={String(theme.grain)} data-ambient={theme.ambient}>
      <noscript><style>{".rv,.wd{opacity:1!important;transform:none!important;filter:none!important}.sw span{opacity:1!important;filter:none!important}"}</style></noscript>
      <Ambient />
      {children}
    </div>
  );
}

/** Inert in the studio preview so clicks don't navigate away from the editor. */
function A({ href, preview, className, title, external, children }: { href: string; preview?: boolean; className?: string; title?: string; external?: boolean; children: ReactNode }) {
  if (preview) return <span className={className}>{children}</span>;
  return external ? <a href={href} className={className} title={title} target="_blank" rel="noopener noreferrer">{children}</a> : <a href={href} className={className} title={title}>{children}</a>;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter((w) => w && !/^the$/i.test(w))
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "K"
  );
}

function coverStyle(i: number): React.CSSProperties {
  const covers = [
    "radial-gradient(90% 120% at 85% 10%, var(--b-accent), transparent 60%), var(--b-surface)",
    "repeating-linear-gradient(115deg, color-mix(in oklab, var(--b-accent) 25%, transparent) 0 2px, transparent 2px 14px), linear-gradient(135deg, color-mix(in oklab, var(--b-accent) 70%, transparent), var(--b-bg))",
    "conic-gradient(from 200deg at 30% 70%, var(--b-accent), var(--b-bg), color-mix(in oklab, var(--b-accent) 45%, transparent), var(--b-bg))",
  ];
  return { background: covers[i % covers.length] };
}

/** The coloured cover strip on a course card. */
export function CourseCover({ index, tag }: { index: number; tag?: string }) {
  return <div className="cov" style={coverStyle(index)}>{tag && <span>{tag}</span>}</div>;
}

/**
 * The header's account control. Signed out: a bordered "Sign in" button. Signed in: the learner's name
 * (linking to My courses, with the email on hover) and the `signOut` control the layout passes in, since
 * that control is a client component that calls server actions and can't be imported here.
 */
/** The site's logo, or its initials when it has none. `showName` decides whether the name sits beside a logo. */
function Brand({ site, chrome, preview }: { site: Site; chrome: SiteChrome; preview?: boolean }) {
  const logo = logoFor(chrome, site.theme);
  return (
    <A href="/" preview={preview} className="sf-brand">
      {logo ? <img className="sf-logo" src={logo} alt={chrome.brand.showName ? "" : site.name} /> : <span className="mark">{initials(site.name)}</span>}
      {(!logo || chrome.brand.showName) && <b>{site.name}</b>}
    </A>
  );
}

/**
 * The header. Links come from the page's own sections unless the creator wrote their own list. The
 * account control: signed out, a bordered "Sign in" button; signed in, the learner's name (linking to My
 * courses, email on hover) and the `signOut` control the layout passes in, since that control is a client
 * component that calls server actions and can't be imported here.
 */
export function SiteNav({ site, blocks, preview, learner, signOut, chrome: given, pages }: SiteProps & { blocks?: Block[]; learner?: { name: string; email: string } | null; signOut?: ReactNode; chrome?: SiteChrome; pages?: readonly Pick<SitePage, "id" | "title" | "slug" | "inMenu">[] }) {
  const s = t(site.theme.lang);
  const chrome = given ?? chromeFor(site);
  const links = headerLinks(chrome, blocks ?? blocksFor(site), site.theme.lang, pages ?? site.pages ?? []);
  const { announcement: bar, nav } = chrome;
  return (
    <>
      {bar.enabled && (
        <div className="sf-announce" role="note">
          {bar.href ? <A href={linkTarget(bar.href)} preview={preview} external={isExternal(bar.href)}>{bar.text} →</A> : bar.text}
        </div>
      )}
      <header className="sf-nav">
        <Brand site={site} chrome={chrome} preview={preview} />
        <nav>
          {links.map((l) => <A key={l.id} href={linkTarget(l.href)} preview={preview} external={isExternal(l.href)}>{l.label}</A>)}
        </nav>
        {nav.showAccount && (
          <div className="acct-area">
            {learner ? (
              <>
                <A href="/my-courses" preview={preview} className="acct-chip" title={learner.email}>
                  <span className="mark sm">{initials(learner.name)}</span>
                  <span>{learner.name.split(" ")[0]}</span>
                </A>
                {!preview && signOut}
              </>
            ) : (
              <A href="/login" preview={preview} className="bbtn ghost sm">{s.signIn}</A>
            )}
          </div>
        )}
        {nav.showCta && <A href={linkTarget(nav.ctaHref)} preview={preview} external={isExternal(nav.ctaHref)} className="bbtn sm">{nav.ctaLabel || s.cta}</A>}
      </header>
    </>
  );
}

export function SiteFooter({ site, host, chrome: given, preview }: { site: Site; host: string; chrome?: SiteChrome; preview?: boolean }) {
  const s = t(site.theme.lang);
  const chrome = given ?? chromeFor(site);
  const { tagline, links, socials, showBuiltWith } = chrome.footer;
  const logo = logoFor(chrome, site.theme);
  const label = (kind: string) => SOCIAL_KINDS.find((k) => k.kind === kind)?.label ?? kind;
  return (
    <footer className="sf-foot">
      {(tagline || links.length > 0 || socials.length > 0 || logo) && (
        <div className="foot-top">
          <div className="foot-id">
            {logo && <img className="sf-logo" src={logo} alt={site.name} />}
            {tagline && <p>{tagline}</p>}
          </div>
          {links.length > 0 && (
            <nav aria-label="Footer">
              <ul>{links.map((l) => <li key={l.id}><A href={linkTarget(l.href)} preview={preview} external={isExternal(l.href)}>{l.label}</A></li>)}</ul>
            </nav>
          )}
          {socials.length > 0 && (
            <ul className="foot-social">
              {socials.map((x) => <li key={x.id}><A href={x.kind === "email" ? `mailto:${x.url}` : x.url} preview={preview} external={x.kind !== "email"}>{label(x.kind)}</A></li>)}
            </ul>
          )}
        </div>
      )}
      <div className="foot-mark" aria-hidden="true">{site.name}</div>
      <div className="foot-row">
        <span>© {new Date().getFullYear()} {site.name} · <A href="/my-courses" preview={preview}>{s.myCourses}</A></span>
        <span>{host}{showBuiltWith ? ` · ${s.builtWith}` : ""}</span>
      </div>
    </footer>
  );
}
