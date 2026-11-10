"use client";

import { useEffect, useState, type ReactNode } from "react";
import { MAX_FOOTER_LINKS, MAX_NAV_LINKS, MAX_SOCIALS, SOCIAL_KINDS, autoNavLinks, newLinkId } from "@/lib/chrome";
import { paletteFromImage } from "@/lib/palette-from-image";
import type { Theme } from "@/lib/theme";
import type { Block, NavLink, SiteChrome, SitePage, SocialKind } from "@/lib/types";
import { Row, Seg, Switch } from "./editor-panels";
import { ImageField } from "./media-library";

// The editor's "Site" panel: everything around the page itself. Brand kit (logo, favicon, share image,
// colours drawn from the logo), the header menu, the announcement bar and the footer.

type Props = {
  chrome: SiteChrome;
  theme: Theme;
  blocks: Block[];
  pages: SitePage[];
  onPreviewPopup: () => void;
  onChrome: (next: (c: SiteChrome) => SiteChrome, key?: string) => void;
  onTheme: (patch: Partial<Theme>, key?: string) => void;
};

function Section({ title, note, children, open = false }: { title: string; note?: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="dsec site-sec" open={open}>
      <summary><h4>{title} {note && <span>{note}</span>}</h4></summary>
      <div className="site-sec-body">{children}</div>
    </details>
  );
}

/** An editable list of text + address rows: add, remove and reorder. Used for the header menu and the footer. */
function LinkList({ items, max, onChange, noun }: { items: NavLink[]; max: number; onChange: (items: NavLink[]) => void; noun: string }) {
  const set = (i: number, patch: Partial<NavLink>) => onChange(items.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="linklist">
      {items.map((l, i) => (
        <div className="linkrow" key={l.id}>
          <input className="input" aria-label={`${noun} ${i + 1} text`} value={l.label} maxLength={28} placeholder="Text" onChange={(e) => set(i, { label: e.target.value })} />
          <input className="input" aria-label={`${noun} ${i + 1} address`} list="link-targets" value={l.href} placeholder="#courses, /page or https://…" onChange={(e) => set(i, { href: e.target.value })} />
          <span className="linkrow-act">
            <button type="button" className="btn sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button type="button" className="btn sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">↓</button>
            <button type="button" className="btn sm danger" onClick={() => onChange(items.filter((_, n) => n !== i))} aria-label={`Remove ${noun} ${i + 1}`}>✕</button>
          </span>
        </div>
      ))}
      {items.length < max && <button type="button" className="btn sm" onClick={() => onChange([...items, { id: newLinkId(), label: "", href: "" }])}>+ Add {noun}</button>}
      {items.length > 0 && items.some((l) => !l.label.trim() || !l.href.trim()) && <span className="hint">Rows without both text and an address are dropped when you publish.</span>}
    </div>
  );
}

/** Colour suggestions drawn from the logo. Pick which accent to set, then click a colour. */
function LogoColours({ logo, theme, onTheme }: { logo: string; theme: Theme; onTheme: Props["onTheme"] }) {
  const [colours, setColours] = useState<string[] | null>(null);
  const [target, setTarget] = useState<"accent" | "accent2">("accent");
  useEffect(() => {
    let live = true;
    setColours(null);
    if (logo) void paletteFromImage(logo).then((c) => live && setColours(c));
    return () => { live = false; };
  }, [logo]);
  if (!logo) return null;
  return (
    <div className="logocolours">
      <Row label="Colours from your logo" hint={colours && colours.length === 0 ? "Couldn't read colours from this image. Links to other sites can't be read; upload it to your library instead." : "Click a colour to use it."}>
        <Seg label="Set" value={target} options={[{ value: "accent", label: "Accent" }, { value: "accent2", label: "Second accent" }]} onChange={setTarget} />
      </Row>
      <div className="cdots">
        {colours === null && <span className="hint">Reading…</span>}
        {colours?.map((c) => (
          <button key={c} type="button" className="swatch" style={{ background: c }} title={`Use ${c}`} aria-label={`Use ${c} as ${target === "accent" ? "accent" : "second accent"}`} aria-pressed={(target === "accent" ? theme.accent : theme.accent2) === c} onClick={() => onTheme({ [target]: c }, `logo:${target}`)} />
        ))}
      </div>
    </div>
  );
}

export function SiteSettings({ chrome, theme, blocks, pages, onPreviewPopup, onChrome, onTheme }: Props) {
  const brand = (patch: Partial<SiteChrome["brand"]>, key: string) => onChrome((c) => ({ ...c, brand: { ...c.brand, ...patch } }), key);
  const nav = (patch: Partial<SiteChrome["nav"]>, key?: string) => onChrome((c) => ({ ...c, nav: { ...c.nav, ...patch } }), key);
  const ann = (patch: Partial<SiteChrome["announcement"]>, key?: string) => onChrome((c) => ({ ...c, announcement: { ...c.announcement, ...patch } }), key);
  const pop = (patch: Partial<SiteChrome["popup"]>, key?: string) => onChrome((c) => ({ ...c, popup: { ...c.popup, ...patch } }), key);
  const track = (patch: Partial<SiteChrome["analytics"]>, key?: string) => onChrome((c) => ({ ...c, analytics: { ...c.analytics, ...patch } }), key);
  const foot = (patch: Partial<SiteChrome["footer"]>, key?: string) => onChrome((c) => ({ ...c, footer: { ...c.footer, ...patch } }), key);
  const auto = autoNavLinks(blocks, theme.lang, pages);

  return (
    <div className="insp">
      <Section title="Brand kit" note="logo and look" open>
        <Row label="Logo" hint="Shown in the header and footer. A wide PNG or SVG with a transparent background works best.">
          <ImageField id="brand-logo" value={chrome.brand.logo} onChange={(v) => brand({ logo: v }, "logo")} />
        </Row>
        <Row label="Logo for dark backgrounds" hint="Optional. Used instead when your page colour is dark, for a logo that's dark on light.">
          <ImageField id="brand-logo-dark" value={chrome.brand.logoDark} onChange={(v) => brand({ logoDark: v }, "logoDark")} />
        </Row>
        {chrome.brand.logo && <Switch on={chrome.brand.showName} onChange={(v) => brand({ showName: v }, "showName")} label="Show the site name next to the logo" />}
        <LogoColours logo={chrome.brand.logo} theme={theme} onTheme={onTheme} />
        <Row label="Favicon" hint="The tiny icon in the browser tab. Square, at least 64 × 64 px. Falls back to the browser default.">
          <ImageField id="brand-favicon" value={chrome.brand.favicon} onChange={(v) => brand({ favicon: v }, "favicon")} />
        </Row>
        <Row label="Share image" hint="The picture people see when your link is shared on WhatsApp, Instagram or Telegram. 1200 × 630 px works best.">
          <ImageField id="brand-share" value={chrome.brand.share} onChange={(v) => brand({ share: v }, "share")} />
        </Row>
      </Section>

      <Section title="Header" note="menu and button">
        <Row label="Menu links">
          <Seg label="Menu links" value={chrome.nav.auto ? "auto" : "custom"} options={[{ value: "auto", label: "From my sections" }, { value: "custom", label: "My own links" }]} onChange={(v) => nav({ auto: v === "auto", links: v === "custom" && chrome.nav.links.length === 0 ? auto.map((l) => ({ id: newLinkId(), label: l.label, href: l.href })) : chrome.nav.links })} />
        </Row>
        {chrome.nav.auto ? (
          <p className="hint">{auto.length ? `Showing: ${auto.map((l) => l.label).join(", ")}. These follow the sections on your page.` : "Add Courses, Live, Stories, About or Questions sections and links appear here."}</p>
        ) : (
          <LinkList items={chrome.nav.links} max={MAX_NAV_LINKS} noun="link" onChange={(links) => nav({ links }, "navlinks")} />
        )}
        <Switch on={chrome.nav.showCta} onChange={(v) => nav({ showCta: v })} label="Show the main button" />
        {chrome.nav.showCta && (
          <div className="linkrow">
            <input className="input" aria-label="Button text" value={chrome.nav.ctaLabel} maxLength={28} placeholder="Default wording" onChange={(e) => nav({ ctaLabel: e.target.value }, "ctaLabel")} />
            <input className="input" aria-label="Button address" list="link-targets" value={chrome.nav.ctaHref} placeholder="#courses" onChange={(e) => nav({ ctaHref: e.target.value }, "ctaHref")} />
          </div>
        )}
        <Switch on={chrome.nav.showAccount} onChange={(v) => nav({ showAccount: v })} label="Show student sign-in" />
        {!chrome.nav.showAccount && <p className="hint">Students can still sign in from the footer.</p>}
      </Section>

      <Section title="Announcement bar" note="top of every page">
        <Switch on={chrome.announcement.enabled} onChange={(v) => ann({ enabled: v })} label="Show an announcement" />
        {chrome.announcement.enabled && (
          <>
            <Row label="Message" hint={`${chrome.announcement.text.length}/140. For a batch start, an offer or a notice.`}>
              <input className="input" value={chrome.announcement.text} maxLength={140} placeholder="New batch starts 1 December. Few seats left." onChange={(e) => ann({ text: e.target.value }, "annText")} />
            </Row>
            <Row label="Link (optional)">
              <input className="input" list="link-targets" value={chrome.announcement.href} placeholder="#live or https://…" onChange={(e) => ann({ href: e.target.value }, "annHref")} />
            </Row>
          </>
        )}
      </Section>

      <Section title="Pop-up" note="appears after a few seconds" open={false}>
        <Switch on={chrome.popup.enabled} onChange={(v) => pop({ enabled: v })} label="Show a pop-up" />
        {chrome.popup.enabled && (
          <>
            <Row label="Title">
              <input className="input" value={chrome.popup.title} maxLength={60} placeholder="New batch starts 1 December" onChange={(e) => pop({ title: e.target.value }, "popTitle")} />
            </Row>
            <Row label="Message" hint={`${chrome.popup.text.length}/220`}>
              <textarea className="input prose" rows={3} value={chrome.popup.text} maxLength={220} placeholder="Reserve your seat this week and get the first lesson free." onChange={(e) => pop({ text: e.target.value }, "popText")} />
            </Row>
            <div className="linkrow">
              <input className="input" aria-label="Pop-up button text" value={chrome.popup.buttonLabel} maxLength={28} placeholder="Button text" onChange={(e) => pop({ buttonLabel: e.target.value }, "popBtn")} />
              <input className="input" aria-label="Pop-up button address" list="link-targets" value={chrome.popup.buttonHref} placeholder="#courses" onChange={(e) => pop({ buttonHref: e.target.value }, "popHref")} />
            </div>
            <Row label={`Show after ${chrome.popup.delay} seconds`}>
              <input type="range" min={0} max={60} step={1} value={chrome.popup.delay} aria-label="Seconds before the pop-up appears" onChange={(e) => pop({ delay: Number(e.target.value) }, "popDelay")} />
            </Row>
            <Row label="How often" hint="Remembered in the visitor's browser. Closing it never blocks the page.">
              <Seg label="How often" value={chrome.popup.repeat} options={[{ value: "once", label: "Once" }, { value: "daily", label: "Daily" }, { value: "always", label: "Every visit" }]} onChange={(v) => pop({ repeat: v })} />
            </Row>
            <button type="button" className="btn sm" onClick={onPreviewPopup}>Preview the pop-up</button>
            <p className="hint">It never appears on sign-in or lesson pages.</p>
          </>
        )}
      </Section>

      <Section title="Tracking" note="analytics" open={false}>
        <Row label="Google Analytics ID" hint={chrome.analytics.ga ? "Measuring visits with Google Analytics." : "Looks like G-ABC123XYZ. Leave empty for none."}>
          <input className="input" value={chrome.analytics.ga} maxLength={16} placeholder="G-XXXXXXXXXX" spellCheck={false} onChange={(e) => track({ ga: e.target.value.trim().toUpperCase() }, "ga")} />
        </Row>
        <Row label="Meta Pixel ID" hint={chrome.analytics.meta ? "Meta (Facebook and Instagram) pixel is active." : "A number of 8 to 20 digits. Leave empty for none."}>
          <input className="input" value={chrome.analytics.meta} maxLength={20} placeholder="1234567890123456" inputMode="numeric" spellCheck={false} onChange={(e) => track({ meta: e.target.value.trim() }, "meta")} />
        </Row>
        {((chrome.analytics.ga && !/^G-[A-Z0-9]{6,14}$/.test(chrome.analytics.ga)) || (chrome.analytics.meta && !/^\d{8,20}$/.test(chrome.analytics.meta))) && (
          <p className="media-err" role="alert">An ID that doesn&apos;t match its format is ignored when you publish.</p>
        )}
        <p className="hint">Only the ID is used; we never add other scripts. Tracking runs on your live site, not in the editor. If your visitors are in a region that requires a cookie notice, you are responsible for showing one.</p>
      </Section>

      <Section title="Footer" note="links and socials">
        <Row label="Tagline" hint="A short line under your logo.">
          <input className="input" value={chrome.footer.tagline} maxLength={140} placeholder="Concept-first physics for JEE and NEET." onChange={(e) => foot({ tagline: e.target.value }, "tagline")} />
        </Row>
        <Row label="Links">
          <LinkList items={chrome.footer.links} max={MAX_FOOTER_LINKS} noun="link" onChange={(links) => foot({ links }, "footlinks")} />
        </Row>
        <Row label="Social links">
          <div className="linklist">
            {chrome.footer.socials.map((x, i) => {
              const set = (patch: Partial<typeof x>) => foot({ socials: chrome.footer.socials.map((s, n) => (n === i ? { ...s, ...patch } : s)) }, `social:${i}`);
              const meta = SOCIAL_KINDS.find((k) => k.kind === x.kind)!;
              return (
                <div className="linkrow" key={x.id}>
                  <select className="input" aria-label={`Social ${i + 1} network`} value={x.kind} onChange={(e) => set({ kind: e.target.value as SocialKind })}>
                    {SOCIAL_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
                  </select>
                  <input className="input" aria-label={`Social ${i + 1} address`} value={x.url} placeholder={meta.placeholder} onChange={(e) => set({ url: e.target.value })} />
                  <span className="linkrow-act">
                    <button type="button" className="btn sm danger" onClick={() => foot({ socials: chrome.footer.socials.filter((_, n) => n !== i) })} aria-label={`Remove social ${i + 1}`}>✕</button>
                  </span>
                </div>
              );
            })}
            {chrome.footer.socials.length < MAX_SOCIALS && (
              <button type="button" className="btn sm" onClick={() => foot({ socials: [...chrome.footer.socials, { id: newLinkId(), kind: SOCIAL_KINDS[0].kind, url: "" }] })}>+ Add social link</button>
            )}
          </div>
        </Row>
        <Switch on={chrome.footer.showBuiltWith} onChange={(v) => foot({ showBuiltWith: v })} label="Show “Built with Kalaa”" />
      </Section>
    </div>
  );
}
