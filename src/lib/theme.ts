import type { CSSProperties } from "react";

// Theme tokens: everything a creator can change about how their brand looks, as plain JSON.
// themeVars() turns it into CSS custom properties (--b-*), and every storefront style reads only those,
// so the live site, the editor canvas and (later) the mobile app render from the same values.

export type Palette = { bg: string; surface: string; ink: string; muted: string };
export type PresetDef = Palette & { name: string; accent: string };

export const PRESETS = {
  obsidian: { name: "Obsidian", bg: "#0d0d0f", surface: "#18181c", ink: "#f3efe6", muted: "#8d8a83", accent: "#d8b46a" },
  ink: { name: "Ink", bg: "#000000", surface: "#101011", ink: "#ffffff", muted: "#8b8b90", accent: "#c7ff9f" },
  paper: { name: "Paper", bg: "#ffffff", surface: "#f2f1ec", ink: "#0a0a0a", muted: "#6b6b70", accent: "#0a0a0a" },
  ivory: { name: "Ivory", bg: "#f5f1e8", surface: "#ffffff", ink: "#1b1a17", muted: "#6f6a60", accent: "#1f4d3a" },
  saffron: { name: "Saffron", bg: "#1b100a", surface: "#29190f", ink: "#fff2e2", muted: "#b89c82", accent: "#ff8a2a" },
  lagoon: { name: "Lagoon", bg: "#e8f1f0", surface: "#ffffff", ink: "#0d2a2e", muted: "#557074", accent: "#0b7a75" },
  midnight: { name: "Midnight", bg: "#0b0d1f", surface: "#151a36", ink: "#e9ecff", muted: "#8a90bd", accent: "#7c8cff" },
  rosewood: { name: "Rosewood", bg: "#fbefee", surface: "#ffffff", ink: "#3a1416", muted: "#8a5d60", accent: "#b23a48" },
} satisfies Record<string, PresetDef>;
export type PresetKey = keyof typeof PRESETS;

/** `serif` is the face for *emphasised* words (set in italic); `mono` is for small labels. */
export const FONTS = {
  instrument: { label: "Instrument", display: "var(--font-instrument-sans), var(--font-deva), Arial, sans-serif", serif: "var(--font-instrument-serif), Georgia, serif", mono: "var(--font-fragment), ui-monospace, monospace", body: "var(--font-instrument-sans), var(--font-deva), Arial, sans-serif", weight: 400, tracking: "-0.055em" },
  luxe: { label: "Luxe", display: "var(--font-bodoni), var(--font-deva), Georgia, serif", serif: "var(--font-bodoni), Georgia, serif", mono: "var(--font-mono), ui-monospace, monospace", body: "var(--font-onest), var(--font-deva), Arial, sans-serif", weight: 500, tracking: "-0.03em" },
  bold: { label: "Bold", display: "var(--font-syne), var(--font-deva), 'Arial Black', sans-serif", serif: "var(--font-dmserif), Georgia, serif", mono: "var(--font-mono), ui-monospace, monospace", body: "var(--font-onest), var(--font-deva), Arial, sans-serif", weight: 700, tracking: "-0.04em" },
  classic: { label: "Classic", display: "var(--font-dmserif), var(--font-deva), Georgia, serif", serif: "var(--font-dmserif), Georgia, serif", mono: "var(--font-mono), ui-monospace, monospace", body: "var(--font-archivo), var(--font-deva), Arial, sans-serif", weight: 400, tracking: "-0.02em" },
  clean: { label: "Clean", display: "var(--font-archivo), var(--font-deva), Arial, sans-serif", serif: "var(--font-instrument-serif), Georgia, serif", mono: "var(--font-mono), ui-monospace, monospace", body: "var(--font-archivo), var(--font-deva), Arial, sans-serif", weight: 800, tracking: "-0.045em" },
  bricolage: { label: "Bricolage", display: "var(--font-bricolage), var(--font-deva), Arial, sans-serif", serif: "var(--font-instrument-serif), Georgia, serif", mono: "var(--font-fragment), ui-monospace, monospace", body: "var(--font-onest), var(--font-deva), Arial, sans-serif", weight: 700, tracking: "-0.045em" },
} as const;
export type FontKey = keyof typeof FONTS;

export const ACCENTS = ["#c7ff9f", "#d8b46a", "#ff8a2a", "#ff5d5d", "#ff7ad9", "#7c8cff", "#3e9cff", "#4de3c1", "#0b7a75", "#1f4d3a", "#b23a48", "#0a0a0a"];

export const LANGS = ["en", "hi"] as const;
export type Lang = (typeof LANGS)[number];

export const MOTIONS = ["off", "calm", "rich"] as const;
export type Motion = (typeof MOTIONS)[number];
export const AMBIENTS = ["none", "aurora", "grid"] as const;
export type Ambient = (typeof AMBIENTS)[number];

// Kept so sites saved before the page builder still load; the page builder replaces both.
export const HERO_LAYOUTS = ["split", "editorial", "center"] as const;
export type HeroLayout = (typeof HERO_LAYOUTS)[number];
export type Sections = { stats: boolean; live: boolean; quotes: boolean; community: boolean };

export type Theme = {
  preset: PresetKey;
  /** Per-colour overrides on top of the preset, so any palette is possible. */
  custom?: Partial<Palette>;
  accent: string;
  /** Second accent, for gradients and the 3D scenes. Falls back to `accent`. */
  accent2?: string;
  font: FontKey;
  radius: number;
  lang: Lang;
  motion: Motion;
  ambient: Ambient;
  grain: boolean;
  glow: boolean;
  hero: HeroLayout;
  sections: Sections;
};

export const DEFAULT_THEME: Theme = {
  preset: "obsidian",
  accent: PRESETS.obsidian.accent,
  font: "luxe",
  radius: 16,
  lang: "en",
  motion: "calm",
  ambient: "none",
  grain: false,
  glow: true,
  hero: "split",
  sections: { stats: true, live: true, quotes: true, community: true },
};

/** One-click moods: a palette, type pairing and motion setting that belong together. */
export const LOOKS: Record<string, { name: string; blurb: string; theme: Partial<Theme> }> = {
  spoon: { name: "Spoon", blurb: "Pure black, oversized type, one pale accent.", theme: { preset: "ink", custom: undefined, accent: "#c7ff9f", accent2: "#8be9ff", font: "instrument", radius: 18, motion: "rich", ambient: "none", grain: false, glow: true } },
  neon: { name: "Neon", blurb: "Deep indigo with a drifting aurora.", theme: { preset: "midnight", custom: undefined, accent: "#8b9bff", accent2: "#ff7ad9", font: "bricolage", radius: 22, motion: "rich", ambient: "aurora", grain: true, glow: true } },
  gallery: { name: "Gallery", blurb: "Warm paper and an editorial serif.", theme: { preset: "ivory", custom: undefined, accent: "#1f4d3a", accent2: "#b8924b", font: "classic", radius: 12, motion: "calm", ambient: "none", grain: true, glow: false } },
  saffron: { name: "Saffron", blurb: "Ember warmth for storytellers.", theme: { preset: "saffron", custom: undefined, accent: "#ff8a2a", accent2: "#ffd36b", font: "bold", radius: 20, motion: "rich", ambient: "aurora", grain: true, glow: true } },
  mono: { name: "Mono", blurb: "White, black and nothing else.", theme: { preset: "paper", custom: undefined, accent: "#0a0a0a", accent2: "#6b6b70", font: "clean", radius: 0, motion: "calm", ambient: "none", grain: false, glow: false } },
  fresh: { name: "Fresh", blurb: "Bright and friendly, for languages and everyday skills.", theme: { preset: "lagoon", custom: undefined, accent: "#0b7a75", accent2: "#ffb703", font: "bricolage", radius: 26, motion: "rich", ambient: "none", grain: false, glow: true } },
  playful: { name: "Playful", blurb: "Warm colour and round shapes for schools and kids.", theme: { preset: "ivory", custom: undefined, accent: "#ff5d5d", accent2: "#ffc94d", font: "bold", radius: 32, motion: "rich", ambient: "none", grain: false, glow: true } },
  salon: { name: "Salon", blurb: "Rosewood and gold, for the performing arts.", theme: { preset: "rosewood", custom: undefined, accent: "#b23a48", accent2: "#d9a05b", font: "classic", radius: 22, motion: "rich", ambient: "none", grain: true, glow: false } },
  obsidian: { name: "Obsidian", blurb: "Champagne gold on near-black.", theme: { preset: "obsidian", custom: undefined, accent: "#d8b46a", accent2: "#f0d9a0", font: "luxe", radius: 16, motion: "calm", ambient: "none", grain: false, glow: true } },
};

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : undefined);

/** Accepts untrusted input (from the editor) and returns a valid theme. */
export function sanitizeTheme(input: unknown): Theme {
  const t = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const s = (t.sections && typeof t.sections === "object" ? t.sections : {}) as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const radius = Number(t.radius);
  const rawCustom = (t.custom && typeof t.custom === "object" ? t.custom : {}) as Record<string, unknown>;
  const custom: Partial<Palette> = {};
  for (const k of ["bg", "surface", "ink", "muted"] as const) {
    const c = hex(rawCustom[k]);
    if (c) custom[k] = c;
  }
  return {
    preset: pick(t.preset, Object.keys(PRESETS) as PresetKey[], DEFAULT_THEME.preset),
    ...(Object.keys(custom).length ? { custom } : {}),
    accent: hex(t.accent) ?? DEFAULT_THEME.accent,
    ...(hex(t.accent2) ? { accent2: hex(t.accent2) } : {}),
    font: pick(t.font, Object.keys(FONTS) as FontKey[], DEFAULT_THEME.font),
    radius: Number.isFinite(radius) ? Math.min(40, Math.max(0, Math.round(radius))) : DEFAULT_THEME.radius,
    lang: pick(t.lang, LANGS, DEFAULT_THEME.lang),
    motion: pick(t.motion, MOTIONS, DEFAULT_THEME.motion),
    ambient: pick(t.ambient, AMBIENTS, DEFAULT_THEME.ambient),
    grain: t.grain === true,
    glow: t.glow !== false,
    hero: pick(t.hero, HERO_LAYOUTS, DEFAULT_THEME.hero),
    sections: { stats: s.stats !== false, live: s.live !== false, quotes: s.quotes !== false, community: s.community !== false },
  };
}

export function paletteOf(theme: Pick<Theme, "preset" | "custom">): Palette {
  const p = PRESETS[theme.preset];
  return { bg: theme.custom?.bg ?? p.bg, surface: theme.custom?.surface ?? p.surface, ink: theme.custom?.ink ?? p.ink, muted: theme.custom?.muted ?? p.muted };
}

export function luminance(color: string) {
  const n = parseInt(color.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text colour that stays readable on top of the accent. */
export const onAccent = (accent: string) => (luminance(accent) > 0.35 ? "#0a0a0a" : "#ffffff");

export function themeVars(theme: Theme): CSSProperties {
  const pal = paletteOf(theme);
  const f = FONTS[theme.font];
  const on = onAccent(theme.accent);
  return {
    "--b-bg": pal.bg,
    "--b-surface": pal.surface,
    "--b-ink": pal.ink,
    "--b-muted": pal.muted,
    "--b-accent": theme.accent,
    "--b-accent2": theme.accent2 ?? theme.accent,
    "--b-on": on,
    // Fixed copies, so a section can swap the live tokens (tones) without referring to itself.
    "--b-bg-base": pal.bg,
    "--b-ink-base": pal.ink,
    "--b-muted-base": pal.muted,
    "--b-accent-base": theme.accent,
    "--b-on-base": on,
    "--b-rad": `${theme.radius}px`,
    "--b-btn": `${Math.min(999, theme.radius * 3)}px`,
    "--b-display": f.display,
    "--b-serif": f.serif,
    "--b-mono": f.mono,
    "--b-body": f.body,
    "--b-dw": String(f.weight),
    "--b-ds": f.tracking,
    colorScheme: luminance(pal.bg) < 0.2 ? "dark" : "light",
  } as CSSProperties;
}

/** Mixes two #rrggbb colours; `amount` is how much of `to` to blend in. */
export function mixHex(from: string, to: string, amount: number) {
  const f = parseInt(from.slice(1), 16);
  const t = parseInt(to.slice(1), 16);
  const ch = (shift: number) => Math.round(((f >> shift) & 255) * (1 - amount) + ((t >> shift) & 255) * amount);
  return "#" + [16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, "0")).join("");
}
