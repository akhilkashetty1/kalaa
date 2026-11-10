import { newBlock, sanitizeBlocks } from "./blocks";
import { emptyCustom, newEl, setDesign, type CustomProps } from "./custom";
import type { Block, SitePage } from "./types";

// Extra pages and the course page template. Pure: shared by the editor, the publish validation and the
// storefront. The home page stays `Site.blocks`; everything else lives here.

export const HOME = "home";
export const COURSE = "course";

export const MAX_PAGES = 12;

/** Paths the platform owns on every storefront. A page can't take them. */
export const RESERVED_SLUGS = new Set(["login", "my-courses", "courses", "learn", "files", "api", "studio", "editor", "explore", "invite", "sites", "admin", "static", "assets", "robots.txt", "sitemap.xml", "favicon.ico"]);

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export const newPageId = () => "pg_" + Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

export const slugFromTitle = (title: string) => title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A free, valid address for a page, given the ones already taken. */
export function uniqueSlug(wanted: string, taken: ReadonlySet<string>): string {
  let base = SLUG.test(wanted) ? wanted : slugFromTitle(wanted) || "page";
  if (RESERVED_SLUGS.has(base)) base = `${base}-page`;
  let slug = base;
  for (let i = 2; taken.has(slug) || RESERVED_SLUGS.has(slug); i++) slug = `${base.slice(0, 36)}-${i}`;
  return slug;
}

/** Accepts untrusted input and returns valid pages: unique ids and addresses, no reserved addresses, safe blocks. */
export function sanitizePages(input: unknown): SitePage[] {
  if (!Array.isArray(input)) return [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const out: SitePage[] = [];
  for (const raw of input.slice(0, MAX_PAGES)) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as Record<string, unknown>;
    const title = clean(p.title, 60);
    if (!title) continue;
    let id = typeof p.id === "string" && /^[a-z0-9_-]{4,40}$/i.test(p.id) && p.id !== HOME && p.id !== COURSE ? p.id : newPageId();
    while (ids.has(id)) id = newPageId();
    ids.add(id);
    const wanted = typeof p.slug === "string" ? clean(p.slug, 40).toLowerCase() : "";
    const finalSlug = uniqueSlug(wanted || title, slugs);
    slugs.add(finalSlug);
    out.push({ id, title, slug: finalSlug, description: clean(p.description, 200), inMenu: p.inMenu === true, blocks: sanitizeBlocks(p.blocks) });
  }
  return out;
}

/** The sections of every course page: the fixed course details, with any sections the teacher added around it. */
export const defaultCourseTemplate = (): Block[] => [newBlock("coursecore")];

/** Exactly one "course details" block, always. If the teacher's template lost it (or never had one) it goes first. */
export function sanitizeCourseTemplate(input: unknown): Block[] {
  const blocks = sanitizeBlocks(input, { core: true });
  const core = blocks.find((b) => b.type === "coursecore") ?? newBlock("coursecore");
  const seen = blocks.filter((b) => b.type !== "coursecore");
  const at = blocks.findIndex((b) => b.type === "coursecore");
  if (at < 0) return [core, ...seen];
  return [...seen.slice(0, at), core, ...seen.slice(at)];
}

/** Splits the course template around its fixed block. The course page renders the two halves around the real course details. */
export function splitTemplate(template: Block[] | undefined): { before: Block[]; after: Block[] } {
  const list = sanitizeCourseTemplate(template ?? defaultCourseTemplate());
  const at = list.findIndex((b) => b.type === "coursecore");
  return { before: list.slice(0, at), after: list.slice(at + 1) };
}

// ---- the editor's view of "the page being edited" ----

type Doc = { blocks: Block[]; pages: SitePage[]; courseTemplate: Block[] };

export function blocksOf(d: Doc, pageId: string): Block[] {
  if (pageId === HOME) return d.blocks;
  if (pageId === COURSE) return d.courseTemplate;
  return d.pages.find((p) => p.id === pageId)?.blocks ?? d.blocks;
}

export function withBlocks<T extends Doc>(d: T, pageId: string, blocks: Block[]): T {
  if (pageId === HOME) return { ...d, blocks };
  if (pageId === COURSE) return { ...d, courseTemplate: blocks };
  return { ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, blocks } : p)) };
}

/** What a new page starts with: a big heading and a paragraph, ready to edit, so it is never a blank screen. */
export function newPage(title: string, taken: ReadonlySet<string>): SitePage {
  const props: CustomProps = setDesign(
    { ...emptyCustom("1"), cols: [[newEl("heading", { text: title, size: "xl" }), newEl("text", { text: "Write about this page here. Add more sections from the Add tab: pictures, videos, course cards and more.", size: "l" })]] },
    { pad: "lg", width: "narrow" },
  );
  return { id: newPageId(), title, slug: uniqueSlug(title, taken), description: "", inMenu: true, blocks: [newBlock("custom", props as unknown as Record<string, unknown>)] };
}

/** A copy of a page under a new title and address. Sections get fresh ids so nothing is shared with the original. */
export function copyPage(page: SitePage, taken: ReadonlySet<string>): SitePage {
  const title = `${page.title} copy`.slice(0, 60);
  const blocks = sanitizeBlocks(JSON.parse(JSON.stringify(page.blocks)).map((b: Block) => ({ ...b, id: undefined })));
  return { ...page, id: newPageId(), title, slug: uniqueSlug(title, taken), blocks };
}
