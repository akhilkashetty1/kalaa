import { upload as uploadToBlob } from "@vercel/blob/client";

// Browser side of every upload (lesson attachments and library images). `base` is the route family:
//   POST  <base>/start     checks name, size and quota, and says where the bytes go
//   POST  <base>           local storage: the file travels through our server
//   POST  <base>/blob      Vercel Blob: issues a token for one key
//   POST  <base>/complete  Vercel Blob: verifies what arrived and records it
// The server decides the mode, so the same code works locally and on Vercel.

export type UploadResult<T> = { item: T; error?: undefined } | { item?: undefined; error: string };

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, credentials: "same-origin" });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

const FALLBACK = "The upload failed. Try again.";

export async function uploadViaApi<T>(base: string, slug: string, file: File): Promise<UploadResult<T>> {
  try {
    const q = `?site=${encodeURIComponent(slug)}`;
    const start = await postJson(`${base}/start${q}`, { name: file.name, size: file.size });
    if (!start.ok) return { error: String(start.body.error ?? FALLBACK) };

    if (start.body.mode === "direct" && typeof start.body.key === "string") {
      await uploadToBlob(start.body.key, file, {
        access: "private",
        handleUploadUrl: `${base}/blob${q}`,
        clientPayload: JSON.stringify({ name: file.name, size: file.size }),
        contentType: "application/octet-stream",
        multipart: file.size > 5 * 1024 * 1024,
      });
      const done = await postJson(`${base}/complete${q}`, { key: start.body.key, name: file.name });
      return done.ok ? { item: done.body as T } : { error: String(done.body.error ?? FALLBACK) };
    }

    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${base}${q}`, { method: "POST", body: fd, credentials: "same-origin" });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return res.ok ? { item: body as T } : { error: String(body.error ?? FALLBACK) };
  } catch {
    return { error: "The upload failed. Check your connection and try again." };
  }
}
