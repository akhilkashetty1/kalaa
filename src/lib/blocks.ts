import { safeLessonUrl } from "./lessons";
import type { Block, Site } from "./types";

// The page builder's block catalogue. Each block type declares its editable fields ONCE; that single
// declaration drives the inspector forms in the editor, the defaults for a new block, and the
// server-side validation of whatever a creator publishes. Pure data: safe to import anywhere.

export const TONES = [
  { value: "base", label: "Page" },
  { value: "surface", label: "Soft" },
  { value: "inverse", label: "Flip" },
  { value: "accent", label: "Accent" },
] as const;
export type Tone = (typeof TONES)[number]["value"];

type Base = { key: string; label: string; hint?: string };
export type Leaf =
  | (Base & { kind: "text"; max: number; default: string; placeholder?: string })
  | (Base & { kind: "textarea"; max: number; default: string })
  | (Base & { kind: "select"; options: readonly { value: string; label: string }[]; default: string })
  | (Base & { kind: "toggle"; default: boolean })
  | (Base & { kind: "link"; default: string })
  | (Base & { kind: "image"; default: string })
  | (Base & { kind: "date"; default: string })
  | (Base & { kind: "number"; min: number; max: number; default: number });
export type Field = Leaf | (Base & { kind: "list"; max: number; itemLabel: string; fields: Leaf[]; default: Record<string, unknown>[] });

export type BlockDef = { label: string; icon: string; blurb: string; tone: Tone; fields: Field[] };

const t = (key: string, label: string, max: number, def = "", extra: Partial<Base & { placeholder: string }> = {}): Leaf => ({ kind: "text", key, label, max, default: def, ...extra });
const ta = (key: string, label: string, max: number, def = ""): Leaf => ({ kind: "textarea", key, label, max, default: def });
const sel = (key: string, label: string, options: readonly [string, string][], def: string): Leaf => ({ kind: "select", key, label, options: options.map(([value, l]) => ({ value, label: l })), default: def });
const link = (key: string, label: string, def = ""): Leaf => ({ kind: "link", key, label, default: def });

export const BLOCKS: Record<string, BlockDef> = {
  hero: {
    label: "Hero",
    icon: "◐",
    blurb: "The first screen: a big headline with a 3D arc, orb or portrait.",
    tone: "base",
    fields: [
      sel("variant", "Style", [["statement", "Statement"], ["arc", "3D arc of courses"], ["orb", "3D orb"], ["split", "Split with portrait"]], "statement"),
      t("eyebrow", "Small label", 40, ""),
      t("headline", "Headline", 120, "Teach what you know, *beautifully*", { hint: "Wrap a word in *stars* to set it in the accent serif." }),
      ta("body", "Intro", 300, "A short line on what you teach and who it's for."),
      t("ctaLabel", "Button", 30, "Start a free lesson"),
      link("ctaHref", "Button link", "#courses"),
      t("cta2Label", "Second button", 30, "See courses"),
      link("cta2Href", "Second link", "#courses"),
      { kind: "image", key: "imageUrl", label: "Portrait image (https)", default: "" },
    ],
  },
  marquee: {
    label: "Ticker",
    icon: "↔",
    blurb: "A scrolling line of words: subjects, results, promises.",
    tone: "base",
    fields: [
      sel("speed", "Speed", [["slow", "Slow"], ["normal", "Normal"], ["fast", "Fast"]], "normal"),
      { kind: "list", key: "items", label: "Words", max: 12, itemLabel: "Word", fields: [t("text", "Text", 40)], default: [{ text: "JEE Advanced" }, { text: "NEET" }, { text: "Olympiad" }, { text: "Live doubt nights" }] },
    ],
  },
  stats: {
    label: "Numbers",
    icon: "№",
    blurb: "Big numbers that count up as they scroll into view.",
    tone: "base",
    fields: [
      sel("variant", "Style", [["giant", "Giant, one per row"], ["row", "Compact row"]], "giant"),
      { kind: "list", key: "items", label: "Numbers", max: 6, itemLabel: "Number", fields: [t("value", "Value", 24, "10,000+"), t("label", "Label", 60, "learners")], default: [{ value: "10,000+", label: "learners taught" }, { value: "4.9", label: "average rating" }, { value: "300+", label: "top results" }] },
    ],
  },
  statement: {
    label: "Big statement",
    icon: "❝",
    blurb: "A paragraph in huge type whose words sharpen as you scroll.",
    tone: "base",
    fields: [
      t("eyebrow", "Small label", 40, "Our method"),
      ta("text", "Statement", 520, "We teach the *idea* first, then the formula. Every lesson starts with a question you can see, not a rule to memorise."),
    ],
  },
  courses: {
    label: "Courses",
    icon: "▦",
    blurb: "Your published courses as tilting cards, a 3D arc or a rail.",
    tone: "base",
    fields: [
      sel("layout", "Layout", [["grid", "Tilt cards"], ["arc", "3D arc"], ["rail", "Scroll rail"]], "grid"),
      t("eyebrow", "Small label", 40, "Courses"),
      t("title", "Title", 80, "Start anywhere"),
      t("subtitle", "Subtitle", 160, "Every course has free preview lessons."),
    ],
  },
  features: {
    label: "Why us",
    icon: "▤",
    blurb: "A bento grid of reasons to learn with you.",
    tone: "surface",
    fields: [
      t("eyebrow", "Small label", 40, "Why learn here"),
      t("title", "Title", 100, "Built around how you *actually* learn"),
      { kind: "list", key: "items", label: "Cards", max: 8, itemLabel: "Card", fields: [t("icon", "Icon (1–2 characters)", 4, "✦"), t("title", "Title", 60, "Short lessons"), ta("body", "Text", 220, "Ten minutes at a time, so it fits your day.")], default: [{ icon: "✦", title: "Short lessons", body: "Ten minutes at a time, so it fits around school and sleep." }, { icon: "◎", title: "Live doubt nights", body: "Ask in real time. Every session is recorded for later." }, { icon: "↗", title: "Daily practice", body: "A five-minute quiz keeps the idea fresh." }, { icon: "☰", title: "Mock tests", body: "Exam-style papers with worked solutions." }] },
    ],
  },
  steps: {
    label: "How it works",
    icon: "≡",
    blurb: "Three or four numbered steps from sign-up to results.",
    tone: "base",
    fields: [
      t("eyebrow", "Small label", 40, "How it works"),
      t("title", "Title", 100, "From first lesson to *top rank*"),
      { kind: "list", key: "items", label: "Steps", max: 6, itemLabel: "Step", fields: [t("title", "Title", 60, "Step"), ta("body", "Text", 200, "What happens here.")], default: [{ title: "Watch the free lesson", body: "No sign-up. Decide if the teaching fits you." }, { title: "Join your batch", body: "Small groups, a fixed schedule, real accountability." }, { title: "Practise daily", body: "Short quizzes and a weekly mock." }, { title: "Rank up", body: "Track progress and fix weak spots fast." }] },
    ],
  },
  live: {
    label: "Live batches",
    icon: "●",
    blurb: "Upcoming live classes with seats left.",
    tone: "base",
    fields: [
      t("eyebrow", "Small label", 40, "Live"),
      t("title", "Title", 80, "Upcoming live batches"),
      t("subtitle", "Subtitle", 160, "Small groups, real-time doubts, recordings forever."),
      { kind: "list", key: "items", label: "Batches", max: 8, itemLabel: "Batch", fields: [t("title", "Name", 80, "New batch"), { kind: "date", key: "date", label: "Starts", default: "2026-12-01" }, t("schedule", "Schedule", 90, "Mon to Fri · 7:00 pm IST"), { kind: "number", key: "seats", label: "Seats left", min: 0, max: 999, default: 20 }], default: [{ title: "Weekend bootcamp", date: "2026-12-06", schedule: "Sat & Sun · 7:00 am IST · 4 weeks", seats: 15 }] },
    ],
  },
  quotes: {
    label: "Student stories",
    icon: "“",
    blurb: "Testimonials as a rotating spotlight or a grid.",
    tone: "surface",
    fields: [
      sel("variant", "Style", [["spotlight", "Spotlight"], ["grid", "Grid"]], "spotlight"),
      t("eyebrow", "Small label", 40, "Stories"),
      t("title", "Title", 80, "Heard from students"),
      { kind: "list", key: "items", label: "Stories", max: 8, itemLabel: "Story", fields: [ta("text", "Quote", 240, "This changed how I study."), t("author", "Name", 60, "Student"), t("detail", "Detail", 80, "Class 12")], default: [{ text: "I stopped memorising formulas. I could see the problem before solving it.", author: "Aditi P.", detail: "AIR 1,184 · JEE Advanced" }, { text: "The doubt nights quoted the exact minute my teacher explained it.", author: "Rohan V.", detail: "Class 12, Kota" }] },
    ],
  },
  about: {
    label: "About the teacher",
    icon: "☺",
    blurb: "Your story, a portrait and a few facts.",
    tone: "base",
    fields: [
      t("eyebrow", "Small label", 40, "Your teacher"),
      t("title", "Title", 100, "Hi, I'm your *teacher*"),
      ta("body", "Story", 800, "Tell learners who you are, why you teach and what they can expect from you."),
      t("name", "Name", 60, ""),
      t("role", "Role", 80, ""),
      { kind: "image", key: "imageUrl", label: "Portrait image (https)", default: "" },
      { kind: "list", key: "items", label: "Facts", max: 4, itemLabel: "Fact", fields: [t("text", "Fact", 60)], default: [{ text: "9 years teaching" }, { text: "IIT Bombay alumnus" }] },
    ],
  },
  faq: {
    label: "Questions",
    icon: "?",
    blurb: "Answers to what learners ask before they join.",
    tone: "base",
    fields: [
      t("eyebrow", "Small label", 40, "FAQ"),
      t("title", "Title", 80, "Before you join"),
      { kind: "list", key: "items", label: "Questions", max: 12, itemLabel: "Question", fields: [t("q", "Question", 140, "A question?"), ta("a", "Answer", 500, "The answer.")], default: [{ q: "Can I try before I pay?", a: "Yes. Every course has free preview lessons you can watch without signing up." }, { q: "How do I pay?", a: "Reserve a seat and we message you on WhatsApp with payment details. Once confirmed, the course opens in your library." }, { q: "Will I get recordings?", a: "Every live class is recorded and added to your course." }] },
    ],
  },
  cta: {
    label: "Call to action",
    icon: "→",
    blurb: "A bold closing band with one button.",
    tone: "accent",
    fields: [
      sel("variant", "Style", [["band", "Full band"], ["card", "Card"]], "band"),
      t("headline", "Headline", 120, "Ready when *you* are"),
      t("body", "Text", 240, "Join thousands of learners."),
      t("ctaLabel", "Button", 30, "Join free"),
      link("ctaHref", "Button link", "#courses"),
    ],
  },
};

export const BLOCK_TYPES = Object.keys(BLOCKS);

/** The field definition behind a prop path such as "headline" or "items.2.title". */
export function fieldFor(type: string, path: string): Leaf | undefined {
  const [head, , sub] = path.split(".");
  const f = BLOCKS[type]?.fields.find((x) => x.key === head);
  if (!f) return undefined;
  return f.kind === "list" ? f.fields.find((x) => x.key === sub) : f;
}

/** Reads a prop by path ("items.2.title"). */
export function getPath(props: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), props);
}

/** Returns a copy of `props` with the value at `path` replaced. */
export function setPath(props: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) return { ...props, [head]: value };
  const child = props[head];
  if (Array.isArray(child)) {
    const [idx, ...tail] = rest;
    const i = Number(idx);
    return { ...props, [head]: child.map((item, n) => (n === i ? (tail.length ? setPath(item as Record<string, unknown>, tail.join("."), value) : value) : item)) };
  }
  return { ...props, [head]: setPath((child as Record<string, unknown>) ?? {}, rest.join("."), value) };
}

// ---------- ids, defaults ----------

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export const newBlockId = () => "bk_" + Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function defaultProps(type: string): Record<string, unknown> {
  const def = BLOCKS[type];
  return Object.fromEntries((def?.fields ?? []).map((f) => [f.key, clone(f.default)]));
}

export function newBlock(type: string, props: Record<string, unknown> = {}, extra: Partial<Block> = {}): Block {
  return { id: newBlockId(), type, tone: BLOCKS[type].tone, props: { ...defaultProps(type), ...props }, ...extra };
}

// ---------- validation ----------

const MAX_BLOCKS = 40;
const SAFE_LINK = /^(#[\w-]{0,40}|\/(?!\/)[\w\-./?=&#%]{0,200}|https:\/\/[^\s<>"']{1,280})$/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max) : "");

function leaf(f: Leaf, v: unknown): string | number | boolean {
  switch (f.kind) {
    case "text":
      return str(v, f.max).replace(/\s*\n+\s*/g, " ").trim();
    case "textarea":
      return str(v, f.max).trim();
    case "select":
      return f.options.some((o) => o.value === v) ? (v as string) : f.default;
    case "toggle":
      return v === true;
    case "link": {
      const s = str(v, 300).trim();
      return s === "" || SAFE_LINK.test(s) ? s : "";
    }
    case "image":
      return (typeof v === "string" && safeLessonUrl(v.trim())) || "";
    case "date":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : f.default;
    case "number": {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.min(f.max, Math.max(f.min, n)) : f.default;
    }
  }
}

export function sanitizeProps(type: string, input: unknown): Record<string, unknown> {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of BLOCKS[type].fields) {
    const v = src[f.key];
    if (f.kind === "list") {
      const arr = Array.isArray(v) ? v.slice(0, f.max) : clone(f.default);
      out[f.key] = arr.map((item) => {
        const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return Object.fromEntries(f.fields.map((lf) => [lf.key, leaf(lf, o[lf.key])]));
      });
    } else {
      out[f.key] = v === undefined ? clone(f.default) : leaf(f, v);
    }
  }
  return out;
}

/** Validates a page from the editor. Unknown block types and fields are dropped, so stored pages are always renderable. */
export function sanitizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: Block[] = [];
  for (const raw of input.slice(0, MAX_BLOCKS)) {
    const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const type = typeof b.type === "string" ? b.type : "";
    if (!BLOCKS[type]) continue;
    let id = typeof b.id === "string" && /^[a-z0-9_-]{4,40}$/i.test(b.id) ? b.id : newBlockId();
    while (seen.has(id)) id = newBlockId();
    seen.add(id);
    const tone = TONES.some((x) => x.value === b.tone) ? (b.tone as Tone) : BLOCKS[type].tone;
    out.push({ id, type, tone, ...(b.hidden === true ? { hidden: true } : {}), props: sanitizeProps(type, b.props) });
  }
  return out;
}

// ---------- pages for sites that predate the builder ----------

/** Rebuilds a page from the old fixed sections, so existing sites keep looking like themselves. */
export function legacyBlocks(site: Site): Block[] {
  const { theme } = site;
  const blocks: Block[] = [
    newBlock("hero", {
      variant: theme.hero === "split" ? "split" : "statement",
      headline: site.headline,
      body: site.bio,
      imageUrl: "",
    }),
  ];
  if (theme.sections.stats) {
    blocks.push(newBlock("stats", { variant: "row", items: [{ value: site.stats.learners.toLocaleString("en-IN"), label: "learners" }, { value: `${site.stats.rating.toFixed(1)}★`, label: "average rating" }, { value: site.stats.results.toLocaleString("en-IN"), label: site.stats.resultsLabel }] }));
  }
  blocks.push(newBlock("courses", { layout: "grid" }));
  if (theme.sections.live && site.live.length) {
    blocks.push(newBlock("live", { items: site.live.map((b) => ({ title: b.title, date: b.startsOn, schedule: b.schedule, seats: b.seatsLeft })) }));
  }
  if (theme.sections.quotes && site.quotes.length) {
    blocks.push(newBlock("quotes", { variant: "grid", items: site.quotes.map((q) => ({ text: q.text, author: q.author, detail: q.detail })) }));
  }
  if (theme.sections.community) {
    blocks.push(newBlock("cta", { headline: site.community.title, body: site.community.body, ctaLabel: site.community.cta }));
  }
  return sanitizeBlocks(blocks);
}

export const blocksFor = (site: Site): Block[] => site.blocks ?? legacyBlocks(site);

/** The headline shown in link previews and the browser tab: the first hero's, else the site's. */
export function taglineOf(site: Site): string {
  const hero = blocksFor(site).find((b) => b.type === "hero");
  return String(hero?.props.headline ?? site.headline).replace(/\*/g, "");
}
