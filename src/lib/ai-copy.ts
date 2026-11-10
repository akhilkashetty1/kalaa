import type { Block } from "./types";

// "Write my page with AI": the model is asked only for words, as strict JSON. Everything it returns is
// parsed and capped here, then merged into the teacher's existing sections (hero, why us, about, questions,
// call to action). It never produces layout, links, images or markup, so a bad reply can't break a page,
// and the draft is still reviewed and published by the teacher. Pure, so it is tested without the API.

export type AiCopy = {
  headline: string;
  intro: string;
  about: string;
  featuresTitle: string;
  features: { icon: string; title: string; text: string }[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  ctaHeadline: string;
  ctaBody: string;
  ctaLabel: string;
};

export const AI_LIMITS = { description: 800, minDescription: 20 } as const;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Pulls the first JSON object out of a model reply, even if it was wrapped in a code fence or sentence. */
function extractJson(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Validates a model reply. Returns null unless there is enough usable copy to be worth applying. */
export function parseCopy(raw: string): AiCopy | null {
  const j = extractJson(raw);
  if (!isObj(j)) return null;
  const features = (Array.isArray(j.features) ? j.features : [])
    .filter(isObj)
    .map((f) => ({ icon: clean(f.icon, 2) || "✦", title: clean(f.title, 60), text: clean(f.text, 220) }))
    .filter((f) => f.title && f.text)
    .slice(0, 6);
  const faq = (Array.isArray(j.faq) ? j.faq : [])
    .filter(isObj)
    .map((f) => ({ q: clean(f.q, 140), a: clean(f.a, 500) }))
    .filter((f) => f.q && f.a)
    .slice(0, 8);
  const copy: AiCopy = {
    headline: clean(j.headline, 120),
    intro: clean(j.intro, 300),
    about: clean(j.about, 800),
    featuresTitle: clean(j.featuresTitle, 100),
    features,
    faqTitle: clean(j.faqTitle, 80),
    faq,
    ctaHeadline: clean(j.ctaHeadline, 120),
    ctaBody: clean(j.ctaBody, 240),
    ctaLabel: clean(j.ctaLabel, 30),
  };
  // A reply with no headline and almost nothing else isn't a draft.
  const filled = [copy.headline, copy.intro, copy.about, copy.ctaHeadline].filter(Boolean).length + (features.length >= 2 ? 1 : 0) + (faq.length >= 2 ? 1 : 0);
  return copy.headline && filled >= 3 ? copy : null;
}

const set = (b: Block, patch: Record<string, unknown>): Block => ({ ...b, props: { ...b.props, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== "" && v !== undefined)) } });

/** Writes the copy into the page's existing sections. Layout, images, links and every other section stay as they are. */
export function applyCopy(blocks: Block[], copy: AiCopy): Block[] {
  let first: Record<string, boolean> = {};
  return blocks.map((b) => {
    const isFirst = !first[b.type];
    first = { ...first, [b.type]: true };
    if (!isFirst) return b; // only the first section of each kind
    switch (b.type) {
      case "hero":
        return set(b, { headline: copy.headline, body: copy.intro });
      case "features":
        return set(b, { title: copy.featuresTitle, items: copy.features.length >= 2 ? copy.features.map((f) => ({ icon: f.icon, title: f.title, body: f.text })) : undefined });
      case "about":
        return set(b, { body: copy.about });
      case "faq":
        return set(b, { title: copy.faqTitle, items: copy.faq.length >= 2 ? copy.faq : undefined });
      case "cta":
        return set(b, { headline: copy.ctaHeadline, body: copy.ctaBody, ctaLabel: copy.ctaLabel });
      default:
        return b;
    }
  });
}
