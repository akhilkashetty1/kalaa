// Media library helpers shared by the server, the editor and the storefront. No I/O.
//
// A library image is referenced everywhere as the path "/api/media/<id>". It is served by one public
// route that works on every host (platform and storefront alike), so the editor preview and the live site
// use the same address. Library files are public by design: they are the images of a public website.

export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export const MEDIA_QUOTA_BYTES = 300 * 1024 * 1024;
export const MAX_MEDIA_PER_SITE = 500;
export const MAX_ALT = 160;

export const MEDIA_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg"] as const;
export const MEDIA_ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.svg";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const MEDIA_PATH = new RegExp(`^/api/media/(${UUID})$`);

export const mediaUrl = (id: string) => `/api/media/${id}`;

/** The library id inside a "/api/media/<id>" path, or null for any other value. */
export const mediaIdOf = (value: unknown) => (typeof value === "string" ? (MEDIA_PATH.exec(value)?.[1] ?? null) : null);

/** Every library id mentioned anywhere in a value (blocks, chrome...). Used to find what a site still uses. */
export function mediaRefs(value: unknown): Set<string> {
  const out = new Set<string>();
  for (const m of JSON.stringify(value ?? null).matchAll(new RegExp(`/api/media/(${UUID})`, "g"))) out.add(m[1]);
  return out;
}

const MAX_URL = 600;

/** An image address the page may show: a library image, or a plain https link (no credentials, no data: or javascript:). */
export function safeImageUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim();
  if (!v || v.length > MAX_URL) return "";
  if (MEDIA_PATH.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : "";
  } catch {
    return "";
  }
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Blanks every library path in `value` whose id is not in `owned`. A site may only show its own images. */
export function dropForeignMedia<T>(value: T, owned: ReadonlySet<string>): T {
  return JSON.parse(JSON.stringify(value).replace(new RegExp(`/api/media/(${UUID})`, "g"), (whole, id: string) => (owned.has(id) ? whole : ""))) as T;
}
