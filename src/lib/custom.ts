import { clone, defaultsFor, fArea, fDate, fImage, fLink, fNumber, fSelect, fText, fToggle, sanitizeFields, type Field } from "./fields";
import { embedFor } from "./lessons";
import { safeImageUrl } from "./media";
import { hex, luminance } from "./theme";

// Custom sections: a row of 1-4 columns, each holding a stack of elements (heading, text, image, button...).
// A teacher can build any layout from these, and nothing here can break the page: every value is an enum,
// a bounded number, a checked colour, a checked link or an allow-listed address. No raw HTML, no CSS
// strings, no scripts. Pure data and functions, shared by the editor, the server's publish validation
// and the storefront renderer.

// ---------- layouts ----------

export const LAYOUTS = [
  { key: "1", cols: 1, label: "One column" },
  { key: "1-1", cols: 2, label: "Two equal" },
  { key: "2-1", cols: 2, label: "Wide + narrow" },
  { key: "1-2", cols: 2, label: "Narrow + wide" },
  { key: "1-1-1", cols: 3, label: "Three equal" },
  { key: "1-2-1", cols: 3, label: "Wide centre" },
  { key: "1-1-1-1", cols: 4, label: "Four equal" },
] as const;
export type LayoutKey = (typeof LAYOUTS)[number]["key"];
export const LAYOUT_KEYS = LAYOUTS.map((l) => l.key) as readonly LayoutKey[];
export const layoutOf = (key: string) => LAYOUTS.find((l) => l.key === key) ?? LAYOUTS[0];

/** Relative column widths, for drawing the layout pickers. */
export const columnWeights = (key: LayoutKey) => key.split("-").map(Number);

// ---------- elements ----------

export type ElementType = "heading" | "text" | "image" | "button" | "video" | "embed" | "list" | "divider" | "spacer" | "countdown" | "iconbox" | "whatsapp" | "courses" | "coursefacts" | "statistic" | "form";
export type El = { id: string; type: ElementType; props: Record<string, unknown> };
export type ElementDef = { label: string; icon: string; blurb: string; fields: Field[] };

export const ELEMENTS: Record<ElementType, ElementDef> = {
  heading: {
    label: "Heading",
    icon: "H",
    blurb: "A title. Wrap a word in *stars* to set it in the accent style.",
    fields: [fText("text", "Text", 160, "A new *heading*"), fSelect("size", "Size", [["xl", "Huge"], ["l", "Large"], ["m", "Medium"]], "l")],
  },
  text: {
    label: "Text",
    icon: "¶",
    blurb: "A paragraph. Leave a blank line between paragraphs.",
    fields: [
      fArea("text", "Text", 1500, "Write something here. Short paragraphs are easier to read."),
      fSelect("size", "Size", [["m", "Normal"], ["l", "Large"]], "m"),
      fSelect("color", "Colour", [["muted", "Soft"], ["ink", "Strong"]], "muted"),
    ],
  },
  image: {
    label: "Image",
    icon: "▣",
    blurb: "A photo or graphic from your library.",
    fields: [
      fImage("src", "Image"),
      fText("alt", "Description", 160, "", { hint: "Read aloud by screen readers." }),
      fSelect("ratio", "Shape", [["auto", "Natural"], ["square", "Square"], ["4:3", "4:3"], ["16:9", "Wide 16:9"], ["3:4", "Portrait 3:4"]], "auto"),
      fSelect("fit", "Fit", [["cover", "Fill the shape"], ["contain", "Show it all"]], "cover"),
      fToggle("round", "Rounded corners", true),
      fLink("href", "Link (optional)"),
    ],
  },
  button: {
    label: "Button",
    icon: "◉",
    blurb: "A button that links to a section, a page or another site.",
    fields: [fText("label", "Text", 30, "Click here"), fLink("href", "Link", "#courses"), fSelect("style", "Style", [["solid", "Filled"], ["ghost", "Outline"]], "solid")],
  },
  video: {
    label: "Video",
    icon: "▶",
    blurb: "A YouTube or Vimeo video that plays on the page.",
    fields: [fText("url", "Video link", 300, "", { placeholder: "https://youtube.com/watch?v=…", hint: "YouTube or Vimeo." }), fText("title", "Title", 80, "Video")],
  },
  embed: {
    label: "Embed",
    icon: "⧉",
    blurb: "A Google Map, Google Form, Calendly or Tally form.",
    fields: [
      fText("url", "Address", 400, "", { placeholder: "https://calendly.com/yourname", hint: "Google Maps (Share → Embed), Google Forms, Calendly or Tally." }),
      fText("title", "Title", 80, "Embedded content"),
      fNumber("height", "Height (px)", 200, 900, 420),
    ],
  },
  list: {
    label: "List",
    icon: "☰",
    blurb: "Bullets, numbers or ticks.",
    fields: [
      fSelect("style", "Style", [["checks", "Ticks"], ["bullets", "Bullets"], ["numbers", "Numbers"]], "checks"),
      { kind: "list", key: "items", label: "Items", max: 12, itemLabel: "Item", fields: [fText("text", "Text", 140, "Item")], default: [{ text: "First point" }, { text: "Second point" }, { text: "Third point" }] },
    ],
  },
  divider: {
    label: "Divider",
    icon: "―",
    blurb: "A thin line or dots to separate things.",
    fields: [fSelect("style", "Style", [["line", "Line"], ["dots", "Dots"]], "line")],
  },
  spacer: {
    label: "Space",
    icon: "↕",
    blurb: "Empty room between elements.",
    fields: [fSelect("size", "Size", [["s", "Small"], ["m", "Medium"], ["l", "Large"], ["xl", "Extra large"]], "m")],
  },
  countdown: {
    label: "Countdown",
    icon: "⏱",
    blurb: "Counts down to a date, like the start of a batch.",
    fields: [
      fDate("date", "Date", "2026-12-01"),
      fText("time", "Time (IST)", 5, "19:00", { hint: "24-hour, like 19:00." }),
      fText("label", "Text above", 80, "Next batch starts in"),
      fText("done", "Text when it's over", 80, "We've started!"),
    ],
  },
  iconbox: {
    label: "Icon + text",
    icon: "✦",
    blurb: "A small symbol with a title and a line of text.",
    fields: [fText("icon", "Symbol (1–2 characters)", 4, "✦"), fText("title", "Title", 80, "A short title"), fArea("text", "Text", 240, "One or two lines about it.")],
  },
  whatsapp: {
    label: "WhatsApp button",
    icon: "✆",
    blurb: "Opens a WhatsApp chat with your number.",
    fields: [
      fText("number", "Number with country code", 20, "919876543210", { hint: "Digits only, like 919876543210." }),
      fText("message", "First message", 200, "Hi! I'd like to know more about your courses."),
      fText("label", "Button text", 30, "Chat on WhatsApp"),
    ],
  },
  // ---- bound to the site's own data: these show what is really in the database ----
  courses: {
    label: "Course cards",
    icon: "▤",
    blurb: "Your published courses, with their real prices and seats left.",
    fields: [
      fText("tag", "Only courses with this badge", 24, "", { hint: "Leave empty to show every published course." }),
      fNumber("limit", "How many to show", 1, 12, 3),
      fToggle("price", "Show the price", true),
      fToggle("seats", "Show seats left", true),
    ],
  },
  coursefacts: {
    label: "Course facts",
    icon: "◔",
    blurb: "Price, seats left, lessons and hours. On a course page it shows that course.",
    fields: [fToggle("price", "Price", true), fToggle("seats", "Seats left", true), fToggle("lessons", "Number of lessons", true), fToggle("hours", "Hours of video", true)],
  },
  statistic: {
    label: "Live number",
    icon: "№",
    blurb: "A number from your site that updates by itself. Hidden until it is above zero.",
    fields: [
      fSelect("kind", "Number", [["students", "Students enrolled"], ["courses", "Published courses"], ["lessons", "Lessons"], ["hours", "Hours of video"]], "students"),
      fText("label", "Text under it", 60, "students learning with us"),
      fText("suffix", "After the number", 4, "+"),
    ],
  },
  // ---- collects information: each submission lands in the Leads inbox ----
  form: {
    label: "Contact form",
    icon: "✉",
    blurb: "Collects name, email and more. Every answer goes to your Leads inbox and to your email.",
    fields: [
      fText("title", "Form name", 60, "Free demo request", { hint: "Shown in your Leads inbox, so you know which form it came from." }),
      fText("button", "Button text", 30, "Send"),
      fText("success", "Thank-you message", 160, "Thanks! We'll get back to you soon."),
      fToggle("phone", "Ask for a phone number", true),
      fToggle("phoneRequired", "Phone number is required", false),
      fToggle("message", "Ask for a message", true),
      { kind: "list", key: "questions", label: "Your own questions", max: 4, itemLabel: "Question", fields: [fText("label", "Question", 60, "Which exam are you preparing for?"), fToggle("required", "Required", false)], default: [] },
      fText("consent", "Consent tick box (optional)", 140, "", { hint: "If you write something, visitors must tick it before sending. For example: I agree to be contacted about courses." }),
      fToggle("notify", "Email me each new lead", true),
    ],
  },
};
export const ELEMENT_TYPES = Object.keys(ELEMENTS) as ElementType[];

/** The data-bound elements, so the editor can mark them as live. */
export const BOUND_ELEMENTS: ReadonlySet<ElementType> = new Set(["courses", "coursefacts", "statistic"]);

/** A form element with the settings that decide what visitors may submit. */
export type FormConfig = { id: string; title: string; button: string; success: string; phone: boolean; phoneRequired: boolean; message: boolean; questions: { label: string; required: boolean }[]; consent: string; notify: boolean };

export function formConfig(el: El): FormConfig {
  const p = el.props;
  const questions = (Array.isArray(p.questions) ? p.questions : []) as { label?: string; required?: boolean }[];
  return {
    id: el.id,
    title: String(p.title ?? "") || "Contact form",
    button: String(p.button ?? "") || "Send",
    success: String(p.success ?? "") || "Thanks! We'll get back to you soon.",
    phone: p.phone !== false,
    phoneRequired: p.phone !== false && p.phoneRequired === true,
    message: p.message !== false,
    questions: questions.filter((q) => q.label).map((q) => ({ label: String(q.label), required: q.required === true })),
    consent: String(p.consent ?? ""),
    notify: p.notify !== false,
  };
}

/** Finds a form element by id anywhere on a site. The server trusts the published site, never the browser, for what a form asks. */
export function findForm(site: { blocks?: { type: string; props: Record<string, unknown> }[]; pages?: { blocks: { type: string; props: Record<string, unknown> }[] }[]; courseTemplate?: { type: string; props: Record<string, unknown> }[] }, id: string): FormConfig | null {
  const lists = [site.blocks ?? [], ...(site.pages ?? []).map((p) => p.blocks), site.courseTemplate ?? []];
  for (const list of lists)
    for (const b of list) {
      if (b.type !== "custom") continue;
      const hit = sanitizeCustom(b.props).cols.flat().find((e) => e.id === id && e.type === "form");
      if (hit) return formConfig(hit);
    }
  return null;
}

export const MAX_PER_COLUMN = 12;
export const MAX_PER_SECTION = 40;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export const newElId = () => "el_" + Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

export const newEl = (type: ElementType, props: Record<string, unknown> = {}): El => ({ id: newElId(), type, props: { ...defaultsFor(ELEMENTS[type].fields), ...props } });

// ---------- allow-lists ----------

/** Hosts a section may embed, with the path each must start with. Everything else is refused. */
const EMBED_HOSTS: { host: string; path: string }[] = [
  { host: "www.google.com", path: "/maps/embed" },
  { host: "docs.google.com", path: "/forms/" },
  { host: "calendly.com", path: "/" },
  { host: "tally.so", path: "/embed/" },
  { host: "www.openstreetmap.org", path: "/export/embed.html" },
];

/** The address if it may be embedded, else "". Plain https only, no credentials. */
export function allowedEmbed(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" || u.username || u.password) return "";
    const ok = EMBED_HOSTS.some((h) => u.hostname === h.host && u.pathname.startsWith(h.path) && (h.path !== "/" || u.pathname.length > 1));
    return ok ? u.toString() : "";
  } catch {
    return "";
  }
}

export const whatsappLink = (number: string, message: string) => `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

/** The moment a countdown ends. Dates are read as Indian Standard Time, which has no daylight saving. */
export const countdownTarget = (date: string, time: string) => Date.parse(`${date}T${/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "00:00"}:00+05:30`);

function sanitizeElement(type: ElementType, input: unknown): Record<string, unknown> {
  const p = sanitizeFields(ELEMENTS[type].fields, input);
  if (type === "video") p.url = typeof p.url === "string" && embedFor(p.url) ? p.url.trim() : "";
  if (type === "embed") p.url = allowedEmbed(String(p.url ?? ""));
  if (type === "whatsapp") {
    const digits = String(p.number ?? "").replace(/[\s+()-]/g, "");
    p.number = /^\d{8,15}$/.test(digits) ? digits : "";
  }
  if (type === "countdown") {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(p.time ?? ""))) p.time = "00:00";
    if (Number.isNaN(Date.parse(String(p.date)))) p.date = "2026-12-01";
  }
  return p;
}

// ---------- section design ----------

const WIDTHS = ["narrow", "contained", "wide", "full"] as const;
const PADS = ["none", "sm", "md", "lg", "xl"] as const;
const GAPS = ["sm", "md", "lg"] as const;
const ALIGNS = ["left", "center", "right"] as const;
const VALIGNS = ["top", "center", "bottom"] as const;
const BG_KINDS = ["none", "color", "gradient", "image"] as const;
const TEXTS = ["auto", "light", "dark"] as const;

export type SectionDesign = {
  width: (typeof WIDTHS)[number];
  pad: (typeof PADS)[number];
  gap: (typeof GAPS)[number];
  align: (typeof ALIGNS)[number];
  valign: (typeof VALIGNS)[number];
  /** On a phone the columns stack; this puts the last column first. */
  reverse: boolean;
  hideMobile: boolean;
  hideDesktop: boolean;
  /** Text colour on a custom background. "auto" picks light or dark from the background. */
  text: (typeof TEXTS)[number];
  bg: { kind: (typeof BG_KINDS)[number]; color: string; color2: string; angle: number; image: string; overlay: number };
};

export const DEFAULT_DESIGN: SectionDesign = {
  width: "contained",
  pad: "md",
  gap: "md",
  align: "left",
  valign: "top",
  reverse: false,
  hideMobile: false,
  hideDesktop: false,
  text: "auto",
  bg: { kind: "none", color: "#1d2433", color2: "#0f1420", angle: 135, image: "", overlay: 45 },
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function sanitizeDesign(input: unknown): SectionDesign {
  const d = isObj(input) ? input : {};
  const bg = isObj(d.bg) ? d.bg : {};
  const base = DEFAULT_DESIGN;
  return {
    width: pick(d.width, WIDTHS, base.width),
    pad: pick(d.pad, PADS, base.pad),
    gap: pick(d.gap, GAPS, base.gap),
    align: pick(d.align, ALIGNS, base.align),
    valign: pick(d.valign, VALIGNS, base.valign),
    reverse: d.reverse === true,
    hideMobile: d.hideMobile === true,
    hideDesktop: d.hideDesktop === true,
    text: pick(d.text, TEXTS, base.text),
    bg: {
      kind: pick(bg.kind, BG_KINDS, "none"),
      color: hex(bg.color) ?? base.bg.color,
      color2: hex(bg.color2) ?? base.bg.color2,
      angle: clamp(bg.angle, 0, 360, base.bg.angle),
      image: safeImageUrl(bg.image),
      overlay: clamp(bg.overlay, 0, 85, base.bg.overlay),
    },
  };
}

// ---------- the section ----------

export type CustomProps = { layout: LayoutKey; cols: El[][]; design: SectionDesign };

export const emptyCustom = (layout: LayoutKey = "1"): CustomProps => ({ layout, cols: Array.from({ length: layoutOf(layout).cols }, () => []), design: clone(DEFAULT_DESIGN) });

/** Accepts untrusted input and returns a valid section. Unknown elements and fields are dropped. */
export function sanitizeCustom(input: unknown): CustomProps {
  const src = isObj(input) ? input : {};
  const layout = pick(src.layout, LAYOUT_KEYS, "1");
  const rawCols = Array.isArray(src.cols) ? src.cols : [];
  const seen = new Set<string>();
  let total = 0;
  const cols = Array.from({ length: layoutOf(layout).cols }, (_, c) => {
    const out: El[] = [];
    for (const raw of (Array.isArray(rawCols[c]) ? (rawCols[c] as unknown[]) : []).slice(0, MAX_PER_COLUMN)) {
      if (total >= MAX_PER_SECTION) break;
      if (!isObj(raw) || typeof raw.type !== "string" || !(raw.type in ELEMENTS)) continue;
      let id = typeof raw.id === "string" && /^[a-z0-9_-]{4,40}$/i.test(raw.id) ? raw.id : newElId();
      while (seen.has(id)) id = newElId();
      seen.add(id);
      const type = raw.type as ElementType;
      out.push({ id, type, props: sanitizeElement(type, raw.props) });
      total++;
    }
    return out;
  });
  return { layout, cols, design: sanitizeDesign(src.design) };
}

/** The section's props as the typed shape. Stored blocks hold them as a plain record. */
export const customOf = (props: Record<string, unknown>): CustomProps => sanitizeCustom(props);

// ---------- editing operations (pure: each returns a new section) ----------

export function locate(p: CustomProps, id: string): { col: number; index: number; el: El } | null {
  for (let col = 0; col < p.cols.length; col++) {
    const index = p.cols[col].findIndex((e) => e.id === id);
    if (index >= 0) return { col, index, el: p.cols[col][index] };
  }
  return null;
}

/** Changes the layout. Columns that disappear hand their elements to the last remaining column; new columns start empty. */
export function withLayout(p: CustomProps, layout: LayoutKey): CustomProps {
  const n = layoutOf(layout).cols;
  const cols = p.cols.slice(0, n).map((c) => [...c]);
  if (p.cols.length > n) cols[n - 1] = [...cols[n - 1], ...p.cols.slice(n).flat()].slice(0, MAX_PER_COLUMN);
  while (cols.length < n) cols.push([]);
  return { ...p, layout, cols };
}

export const countElements = (p: CustomProps) => p.cols.reduce((n, c) => n + c.length, 0);

export function addEl(p: CustomProps, col: number, el: El, index = p.cols[col]?.length ?? 0): CustomProps {
  if (!p.cols[col] || p.cols[col].length >= MAX_PER_COLUMN || countElements(p) >= MAX_PER_SECTION) return p;
  return { ...p, cols: p.cols.map((c, i) => (i === col ? [...c.slice(0, index), el, ...c.slice(index)] : c)) };
}

export const removeEl = (p: CustomProps, id: string): CustomProps => ({ ...p, cols: p.cols.map((c) => c.filter((e) => e.id !== id)) });

/** Moves an element within its column (by `dir`), or to another column's end. */
export function moveEl(p: CustomProps, id: string, to: { dir: -1 | 1 } | { col: number }): CustomProps {
  const at = locate(p, id);
  if (!at) return p;
  if ("dir" in to) {
    const j = at.index + to.dir;
    if (j < 0 || j >= p.cols[at.col].length) return p;
    return { ...p, cols: p.cols.map((c, i) => (i === at.col ? swap(c, at.index, j) : c)) };
  }
  if (to.col === at.col || !p.cols[to.col] || p.cols[to.col].length >= MAX_PER_COLUMN) return p;
  return addEl(removeEl(p, id), to.col, at.el);
}

const swap = <T,>(list: T[], i: number, j: number) => {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export function duplicateEl(p: CustomProps, id: string): { props: CustomProps; id: string | null } {
  const at = locate(p, id);
  if (!at) return { props: p, id: null };
  const copy: El = { ...clone(at.el), id: newElId() };
  const next = addEl(p, at.col, copy, at.index + 1);
  return { props: next, id: next === p ? null : copy.id };
}

export const setElProp = (p: CustomProps, id: string, key: string, value: unknown): CustomProps => ({
  ...p,
  cols: p.cols.map((c) => c.map((e) => (e.id === id ? { ...e, props: { ...e.props, [key]: value } } : e))),
});

export const setDesign = (p: CustomProps, patch: Partial<Omit<SectionDesign, "bg">> & { bg?: Partial<SectionDesign["bg"]> }): CustomProps => ({
  ...p,
  design: { ...p.design, ...patch, bg: { ...p.design.bg, ...patch.bg } },
});

/** A short description of the section for the layers list: its first heading or paragraph. */
export function firstText(p: CustomProps): string {
  for (const col of p.cols)
    for (const e of col) {
      const t = e.type === "heading" || e.type === "text" || e.type === "iconbox" ? e.props.text ?? e.props.title : e.type === "button" ? e.props.label : "";
      if (typeof t === "string" && t.trim()) return t.replace(/\*/g, "").slice(0, 40);
    }
  const n = countElements(p);
  return n ? `${n} element${n === 1 ? "" : "s"}` : "Empty";
}

// ---------- rendering helpers ----------

/** Whether the text on this section's background should be light or dark, or the theme's own when there is no background. */
export function textMode(d: SectionDesign): "light" | "dark" | null {
  if (d.text !== "auto") return d.text;
  const { bg } = d;
  if (bg.kind === "color") return luminance(bg.color) < 0.42 ? "light" : "dark";
  if (bg.kind === "gradient") return (luminance(bg.color) + luminance(bg.color2)) / 2 < 0.42 ? "light" : "dark";
  if (bg.kind === "image" && bg.image) return bg.overlay >= 30 ? "light" : null;
  return null;
}

/** Classes on the section element that set its width, spacing, alignment and per-device visibility. */
export function sectionClasses(p: CustomProps): string {
  const d = p.design;
  const mode = textMode(d);
  return [
    "cs",
    `cs-w-${d.width}`,
    `cs-p-${d.pad}`,
    `cs-g-${d.gap}`,
    `cs-a-${d.align}`,
    `cs-v-${d.valign}`,
    d.reverse && "cs-rev",
    d.hideMobile && "cs-hm",
    d.hideDesktop && "cs-hd",
    d.bg.kind !== "none" && "cs-hasbg",
    mode && `cs-tx-${mode}`,
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------- starting points ----------

export type Starter = { id: string; label: string; blurb: string; build: () => CustomProps };

const withDesign = (p: CustomProps, patch: Parameters<typeof setDesign>[1]) => setDesign(p, patch);
const filled = (layout: LayoutKey, cols: El[][], design: Parameters<typeof setDesign>[1] = {}): CustomProps => withDesign({ ...emptyCustom(layout), cols }, design);

export const STARTERS: Starter[] = [
  {
    id: "blank",
    label: "Blank section",
    blurb: "An empty row. Add anything you like.",
    build: () => emptyCustom("1"),
  },
  {
    id: "text-image",
    label: "Text + picture",
    blurb: "A heading, a paragraph and a button beside an image.",
    build: () =>
      filled("1-1", [
        [newEl("heading", { text: "Learn the way that *clicks*", size: "l" }), newEl("text", { text: "Tell people what you teach, who it is for, and what they will be able to do afterwards." }), newEl("button", { label: "See courses", href: "#courses" })],
        [newEl("image", { ratio: "4:3" })],
      ], { valign: "center", gap: "lg", pad: "lg" }),
  },
  {
    id: "three-points",
    label: "Three points",
    blurb: "Three short highlights side by side.",
    build: () =>
      filled("1-1-1", [
        [newEl("iconbox", { icon: "✦", title: "Short lessons", text: "Ten minutes at a time, so it fits your day." })],
        [newEl("iconbox", { icon: "◎", title: "Live doubt nights", text: "Ask in real time. Every session is recorded." })],
        [newEl("iconbox", { icon: "↗", title: "Daily practice", text: "A five-minute quiz keeps the idea fresh." })],
      ]),
  },
  {
    id: "announce",
    label: "Centred message",
    blurb: "A big centred line with a button, on a coloured band.",
    build: () =>
      filled("1", [[newEl("heading", { text: "Ready when *you* are", size: "xl" }), newEl("text", { text: "Start with a free lesson. No sign-up needed.", size: "l" }), newEl("button", { label: "Start free", href: "#courses" })]], {
        align: "center",
        pad: "xl",
        width: "narrow",
        bg: { kind: "gradient", color: "#1d2433", color2: "#3b2a63", angle: 135 },
      }),
  },
  {
    id: "video-notes",
    label: "Video + notes",
    blurb: "A video with a short list beside it.",
    build: () =>
      filled("2-1", [[newEl("video", { title: "Watch a sample lesson" })], [newEl("heading", { text: "What you'll get", size: "m" }), newEl("list", { style: "checks" })]], { valign: "center", gap: "lg" }),
  },
  {
    id: "countdown",
    label: "Countdown",
    blurb: "A live countdown to your next batch, with a button.",
    build: () => filled("1", [[newEl("countdown"), newEl("button", { label: "Reserve a seat", href: "#courses" })]], { align: "center", pad: "lg", width: "narrow" }),
  },
  {
    id: "lead-form",
    label: "Contact form",
    blurb: "A heading and a form that sends every enquiry to your Leads inbox.",
    build: () => filled("1-1", [[newEl("heading", { text: "Book a *free demo*", size: "l" }), newEl("text", { text: "Leave your details and we will call you back within a day." }), newEl("list", { style: "checks" })], [newEl("form")]], { valign: "center", gap: "lg", pad: "lg" }),
  },
  {
    id: "contact",
    label: "Talk to us",
    blurb: "A short pitch and a WhatsApp button.",
    build: () =>
      filled("1-1", [[newEl("heading", { text: "Questions? *Just ask.*", size: "m" }), newEl("text", { text: "Message us and we will reply the same day." })], [newEl("whatsapp"), newEl("spacer", { size: "s" }), newEl("text", { text: "Mon to Sat, 9 am to 8 pm IST.", color: "muted" })]], { valign: "center" }),
  },
];
