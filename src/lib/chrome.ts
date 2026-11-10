import { SAFE_LINK } from "./blocks";
import { t } from "./i18n";
import { safeImageUrl } from "./media";
import { luminance, paletteOf, type Lang, type Theme } from "./theme";
import type { Block, NavLink, SiteChrome, SitePage, SocialKind } from "./types";

// The brand kit, header, announcement bar and footer. Pure and shared: the editor, the server's
// publish validation and the storefront all read the same shape.

export const SOCIAL_KINDS: readonly { kind: SocialKind; label: string; placeholder: string }[] = [
  { kind: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourname" },
  { kind: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourchannel" },
  { kind: "whatsapp", label: "WhatsApp", placeholder: "https://wa.me/919876543210" },
  { kind: "telegram", label: "Telegram", placeholder: "https://t.me/yourchannel" },
  { kind: "x", label: "X", placeholder: "https://x.com/yourname" },
  { kind: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourpage" },
  { kind: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/yourname" },
  { kind: "email", label: "Email", placeholder: "hello@yourname.in" },
];

export const MAX_NAV_LINKS = 8;
export const MAX_FOOTER_LINKS = 8;
export const MAX_SOCIALS = 8;

export const DEFAULT_CHROME: SiteChrome = {
  brand: { logo: "", logoDark: "", favicon: "", share: "", showName: true },
  nav: { auto: true, links: [], ctaLabel: "", ctaHref: "/#courses", showCta: true, showAccount: true },
  announcement: { enabled: false, text: "", href: "" },
  popup: { enabled: false, title: "", text: "", buttonLabel: "", buttonHref: "", delay: 6, repeat: "daily" },
  analytics: { ga: "", meta: "" },
  footer: { tagline: "", links: [], socials: [], showBuiltWith: true },
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export const newLinkId = () => "ln_" + Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const href = (v: unknown) => {
  const s = clean(v, 300);
  return SAFE_LINK.test(s) ? s : "";
};

function links(input: unknown, max: number): NavLink[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: NavLink[] = [];
  for (const raw of input.slice(0, max)) {
    if (!isObj(raw)) continue;
    const label = clean(raw.label, 28);
    const target = href(raw.href);
    if (!label || !target) continue; // a half-filled row is dropped rather than saved as a dead link
    let id = typeof raw.id === "string" && /^[a-z0-9_-]{4,40}$/i.test(raw.id) ? raw.id : newLinkId();
    while (seen.has(id)) id = newLinkId();
    seen.add(id);
    out.push({ id, label, href: target });
  }
  return out;
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

/** Accepts untrusted input and returns a complete, valid chrome. Missing parts take their defaults. */
export function sanitizeChrome(input: unknown): SiteChrome {
  const c = isObj(input) ? input : {};
  const brand = isObj(c.brand) ? c.brand : {};
  const nav = isObj(c.nav) ? c.nav : {};
  const ann = isObj(c.announcement) ? c.announcement : {};
  const foot = isObj(c.footer) ? c.footer : {};
  const kinds = new Set<string>(SOCIAL_KINDS.map((k) => k.kind));

  const socials: SiteChrome["footer"]["socials"] = [];
  for (const raw of (Array.isArray(foot.socials) ? foot.socials : []).slice(0, MAX_SOCIALS)) {
    if (!isObj(raw) || typeof raw.kind !== "string" || !kinds.has(raw.kind)) continue;
    const kind = raw.kind as SocialKind;
    const url = kind === "email" ? clean(raw.url, 120).toLowerCase() : clean(raw.url, 300);
    const ok = kind === "email" ? EMAIL.test(url) : SAFE_LINK.test(url) && url.startsWith("https://");
    if (ok) socials.push({ id: typeof raw.id === "string" && /^[a-z0-9_-]{4,40}$/i.test(raw.id) ? raw.id : newLinkId(), kind, url });
  }

  const pop = isObj(c.popup) ? c.popup : {};
  const an = isObj(c.analytics) ? c.analytics : {};
  const popTitle = clean(pop.title, 60);
  const popText = clean(pop.text, 220);
  const delay = Math.round(Number(pop.delay));
  const announcementText = clean(ann.text, 140);
  return {
    brand: {
      logo: safeImageUrl(brand.logo),
      logoDark: safeImageUrl(brand.logoDark),
      favicon: safeImageUrl(brand.favicon),
      share: safeImageUrl(brand.share),
      showName: brand.showName !== false,
    },
    nav: {
      auto: nav.auto !== false,
      links: links(nav.links, MAX_NAV_LINKS),
      ctaLabel: clean(nav.ctaLabel, 28),
      ctaHref: href(nav.ctaHref) || DEFAULT_CHROME.nav.ctaHref,
      showCta: nav.showCta !== false,
      showAccount: nav.showAccount !== false,
    },
    announcement: { enabled: ann.enabled === true && announcementText !== "", text: announcementText, href: href(ann.href) },
    popup: {
      enabled: pop.enabled === true && (popTitle !== "" || popText !== ""),
      title: popTitle,
      text: popText,
      buttonLabel: clean(pop.buttonLabel, 28),
      buttonHref: href(pop.buttonHref),
      delay: Number.isFinite(delay) ? Math.min(60, Math.max(0, delay)) : DEFAULT_CHROME.popup.delay,
      repeat: pop.repeat === "once" || pop.repeat === "always" ? pop.repeat : "daily",
    },
    analytics: {
      // Google Analytics 4 ("G-XXXXXXXXXX") and Meta Pixel (digits). Anything else is dropped, so nothing else can reach a <script>.
      ga: typeof an.ga === "string" && /^G-[A-Z0-9]{6,14}$/.test(an.ga.trim().toUpperCase()) ? an.ga.trim().toUpperCase() : "",
      meta: typeof an.meta === "string" && /^\d{8,20}$/.test(an.meta.trim()) ? an.meta.trim() : "",
    },
    footer: { tagline: clean(foot.tagline, 140), links: links(foot.links, MAX_FOOTER_LINKS), socials, showBuiltWith: foot.showBuiltWith !== false },
  };
}

export const chromeFor = (site: { chrome?: SiteChrome }): SiteChrome => sanitizeChrome(site.chrome);

/** Header links derived from the sections on the page, the way the header worked before it could be edited. */
export function autoNavLinks(blocks: Block[], lang: Lang, pages: readonly Pick<SitePage, "id" | "title" | "slug" | "inMenu">[] = []): NavLink[] {
  const s = t(lang);
  const has = (type: string) => blocks.some((b) => !b.hidden && b.type === type);
  const out: [string, string, string][] = [];
  if (has("courses")) out.push(["courses", s.nav.courses, "/#courses"]);
  if (has("live")) out.push(["live", s.nav.live, "/#live"]);
  if (has("quotes")) out.push(["stories", s.nav.stories, "/#stories"]);
  if (has("about")) out.push(["about", "About", "/#about"]);
  if (has("faq")) out.push(["faq", "FAQ", "/#faq"]);
  const links = out.map(([id, label, to]) => ({ id: `auto_${id}`, label, href: to }));
  // Pages marked "show in menu" follow the section links, in the order the teacher arranged them.
  for (const p of pages) if (p.inMenu) links.push({ id: `auto_${p.id}`, label: p.title.slice(0, 28), href: `/${p.slug}` });
  return links;
}

/** "#courses" works only on the home page, so links to sections are made absolute for every other page. */
export const linkTarget = (to: string) => (to.startsWith("#") ? `/${to}` : to);

export const isExternal = (to: string) => to.startsWith("https://");

/** The header links to show: the page's own sections, or the creator's hand-made list. */
export function headerLinks(chrome: SiteChrome, blocks: Block[], lang: Lang, pages: readonly Pick<SitePage, "id" | "title" | "slug" | "inMenu">[] = []): NavLink[] {
  return chrome.nav.auto ? autoNavLinks(blocks, lang, pages) : chrome.nav.links;
}

/** Light-on-dark logos are for dark pages. Falls back to the main logo when there is no dark variant. */
export function logoFor(chrome: SiteChrome, theme: Pick<Theme, "preset" | "custom">) {
  const dark = luminance(paletteOf(theme).bg) < 0.2;
  return (dark && chrome.brand.logoDark) || chrome.brand.logo;
}

/** Where the "Add to header" suggestions point: every anchor a section on this page offers. */
export function anchorChoices(blocks: Block[], lang: Lang): { label: string; href: string }[] {
  return autoNavLinks(blocks, lang).map((l) => ({ label: l.label, href: l.href }));
}
