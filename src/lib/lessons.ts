import type { Lesson, LessonFile } from "./types";

// Lesson text format used in the studio: one lesson per line, "title | minutes | free | link".
// Minutes, "free" and the link are all optional. Pure functions, shared by the studio and the player.

export const MAX_LESSONS = 200;
const MAX_URL = 300;

/** Only plain https links are accepted. This blocks javascript:, data: and credential-bearing URLs. */
export function safeLessonUrl(raw: string): string | null {
  if (!raw || raw.length > MAX_URL) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function parseLessons(text: string): { lessons: Lesson[] } | { error: string } {
  const lessons: Lesson[] = [];
  const isLink = (s?: string) => !!s && /^https?:\/\//i.test(s);

  for (const line of text.split("\n")) {
    const parts = line.split("|").map((p) => p.trim());
    const title = parts[0];
    if (!title) continue;
    let [, minutes, free, url] = parts;
    // Be forgiving about column order: a link in the minutes or free column is still a link.
    if (isLink(minutes)) [minutes, free, url] = ["", "", minutes];
    else if (isLink(free)) [free, url] = ["", free];

    let link: string | undefined;
    if (url) {
      const safe = safeLessonUrl(url);
      if (!safe) return { error: `The link for “${title.slice(0, 40)}” isn't a valid https address.` };
      link = safe;
    }
    lessons.push({
      title: title.slice(0, 120),
      minutes: Math.min(600, Math.max(1, parseInt(minutes ?? "", 10) || 10)),
      free: /^(free|yes|y)$/i.test(free ?? ""),
      ...(link ? { url: link } : {}),
    });
    if (lessons.length > MAX_LESSONS) return { error: `A course can have at most ${MAX_LESSONS} lessons.` };
  }
  return { lessons };
}

export function lessonsToText(lessons: Lesson[]): string {
  return lessons
    .map((l) => {
      const cols = [l.title, String(l.minutes), l.free ? "free" : "", l.url ?? ""];
      while (cols.length > 2 && cols[cols.length - 1] === "") cols.pop();
      return cols.join(" | ");
    })
    .join("\n");
}

/** An inline player URL for YouTube and Vimeo links, or null when the link should open in a new tab instead. */
export function embedFor(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  let id: string | undefined;
  if (host === "youtube.com") id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,15})/)?.[1];
  else if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  if (id && /^[\w-]{6,15}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
  if (host === "vimeo.com") {
    const m = u.pathname.match(/^\/(\d{5,12})(?:\/|$)/);
    if (m) return `https://player.vimeo.com/video/${m[1]}`;
  }
  return null;
}

/** Lessons are keyed by title, so reordering a course keeps everyone's progress. Renaming a lesson resets only that lesson. */
export const lessonKey = (title: string) => title.trim().toLowerCase().slice(0, 120);

export const MAX_FILES_PER_LESSON = 10;

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Builds lessons from what the lesson editor sends. Attached files are looked up by id in `known` (the site's
 * own uploads), never trusted from the browser, so a lesson can't point at someone else's file.
 */
export function lessonsFromRows(input: unknown, known: Map<string, LessonFile>): { lessons: Lesson[] } | { error: string } {
  if (!Array.isArray(input)) return { error: "The lesson list couldn't be read. Reload the page and try again." };
  if (input.length > MAX_LESSONS) return { error: `A course can have at most ${MAX_LESSONS} lessons.` };
  const lessons: Lesson[] = [];
  for (let i = 0; i < input.length; i++) {
    const r = (input[i] && typeof input[i] === "object" ? input[i] : {}) as Record<string, unknown>;
    const title = String(r.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const n = i + 1;
    if (!title) return { error: `Lesson ${n} needs a title. Fill it in or remove the row.` };
    const minutes = Math.min(600, Math.max(1, Math.round(Number(r.minutes)) || 10));
    const urlRaw = String(r.url ?? "").trim();
    let url: string | undefined;
    if (urlRaw) {
      url = safeLessonUrl(urlRaw) ?? undefined;
      if (!url) return { error: `The link for lesson ${n} (“${title.slice(0, 30)}”) isn't a valid https address.` };
    }
    const ids = Array.isArray(r.files) ? r.files.map(String) : [];
    if (ids.length > MAX_FILES_PER_LESSON) return { error: `Lesson ${n} has more than ${MAX_FILES_PER_LESSON} files.` };
    const files: LessonFile[] = [];
    for (const id of new Set(ids)) {
      const f = known.get(id);
      if (!f) return { error: `A file on lesson ${n} is no longer available. Remove it and upload it again.` };
      files.push({ id: f.id, name: f.name, size: f.size, type: f.type });
    }
    lessons.push({ title, minutes, free: r.free === true, ...(url ? { url } : {}), ...(files.length ? { files } : {}) });
  }
  return { lessons };
}
