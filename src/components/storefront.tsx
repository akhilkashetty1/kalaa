import type { ReactNode } from "react";
import { blocksFor } from "@/lib/blocks";
import { t } from "@/lib/i18n";
import { themeVars, type Theme } from "@/lib/theme";
import type { Block, Course, Site } from "@/lib/types";
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
function A({ href, preview, className, title, children }: { href: string; preview?: boolean; className?: string; title?: string; children: ReactNode }) {
  return preview ? <span className={className}>{children}</span> : <a href={href} className={className} title={title}>{children}</a>;
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
export function SiteNav({ site, blocks, preview, learner, signOut }: SiteProps & { blocks?: Block[]; learner?: { name: string; email: string } | null; signOut?: ReactNode }) {
  const s = t(site.theme.lang);
  const all = (blocks ?? blocksFor(site)).filter((b) => !b.hidden);
  const has = (type: string) => all.some((b) => b.type === type);
  return (
    <header className="sf-nav">
      <A href="/" preview={preview} className="sf-brand">
        <span className="mark">{initials(site.name)}</span>
        <b>{site.name}</b>
      </A>
      <nav>
        {has("courses") && <A href="/#courses" preview={preview}>{s.nav.courses}</A>}
        {has("live") && <A href="/#live" preview={preview}>{s.nav.live}</A>}
        {has("quotes") && <A href="/#stories" preview={preview}>{s.nav.stories}</A>}
        {has("about") && <A href="/#about" preview={preview}>About</A>}
        {has("faq") && <A href="/#faq" preview={preview}>FAQ</A>}
      </nav>
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
      <A href="/#courses" preview={preview} className="bbtn sm">{s.cta}</A>
    </header>
  );
}

export function SiteFooter({ site, host }: { site: Site; host: string }) {
  return (
    <footer className="sf-foot">
      <div className="foot-mark" aria-hidden="true">{site.name}</div>
      <div className="foot-row">
        <span>© {new Date().getFullYear()} {site.name}</span>
        <span>{host} · {t(site.theme.lang).builtWith}</span>
      </div>
    </footer>
  );
}
