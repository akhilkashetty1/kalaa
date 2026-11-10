import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { MAX_ALT, MAX_MEDIA_BYTES, MAX_MEDIA_PER_SITE, MEDIA_EXTENSIONS, MEDIA_QUOTA_BYTES, mediaRefs } from "@/lib/media";
import type { MediaItem } from "@/lib/types";
import { db, fromDoc, toDoc } from "@/server/db";
import { UserError } from "@/server/errors";
import { blobStore } from "@/server/storage";
import { cleanName } from "@/server/files";

// The media library: images a teacher uploads for their site (logo, photos, share image).
// MongoDB keeps the record; the BlobStore keeps the bytes. Every upload is checked by its real contents,
// not its name, and capped per file, per site and per count. Library files are public by design: the
// public route (app/api/media/[id]) serves them on every host.
//
// Same two upload paths as lesson attachments: through our route (local storage), or straight to the
// private Blob store with a token scoped to one key, followed by a check of what actually arrived.

export class MediaError extends UserError {}

const SNIFF_BYTES = 128 * 1024; // enough to find the size of any JPEG, even with a large EXIF block
const MAX_SVG_BYTES = 512 * 1024;

export const mediaKey = (siteId: string, id: string) => `media/${siteId}/${id}`;

type Sniffed = { width?: number; height?: number };
type TypeRule = { mime: string; maxBytes: number; read: (b: Buffer) => Sniffed | null };

const at = (b: Buffer, sig: number[], from = 0) => b.length >= from + sig.length && sig.every((v, i) => b[from + i] === v);

function jpeg(b: Buffer): Sniffed | null {
  if (!at(b, [0xff, 0xd8, 0xff])) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return {};
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return {};
}

function png(b: Buffer): Sniffed | null {
  if (!at(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) || b.length < 24) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function gif(b: Buffer): Sniffed | null {
  if (!(at(b, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || at(b, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) || b.length < 10) return null;
  return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
}

function webp(b: Buffer): Sniffed | null {
  if (!at(b, [0x52, 0x49, 0x46, 0x46]) || !at(b, [0x57, 0x45, 0x42, 0x50], 8) || b.length < 30) return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") return { width: 1 + (((b[22] & 0x3f) << 8) | b[21]), height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)) };
  if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  return {};
}

/**
 * An SVG is a document that can carry script. As an <img> it is inert, and it is served with a sandboxing
 * CSP if someone opens it directly, but it is also refused here if it contains anything active.
 */
const ACTIVE_SVG = /<script|<foreignObject|<iframe|<embed|<object|<link\b|<!ENTITY|\son[a-z]+\s*=|javascript:|data:text\/html|@import/i;
function svg(b: Buffer): Sniffed | null {
  const text = b.toString("utf8").replace(/^﻿/, "").trimStart();
  if (!/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(text)) return null;
  if (ACTIVE_SVG.test(text)) return null;
  return {};
}

const TYPES: Record<string, TypeRule> = {
  png: { mime: "image/png", maxBytes: MAX_MEDIA_BYTES, read: png },
  jpg: { mime: "image/jpeg", maxBytes: MAX_MEDIA_BYTES, read: jpeg },
  jpeg: { mime: "image/jpeg", maxBytes: MAX_MEDIA_BYTES, read: jpeg },
  webp: { mime: "image/webp", maxBytes: MAX_MEDIA_BYTES, read: webp },
  gif: { mime: "image/gif", maxBytes: MAX_MEDIA_BYTES, read: gif },
  svg: { mime: "image/svg+xml", maxBytes: MAX_SVG_BYTES, read: svg },
};

const extOf = (name: string) => path.extname(name).slice(1).toLowerCase();
const badContents = (name: string) => new MediaError(`That doesn't look like a real ${extOf(name).toUpperCase()} image${extOf(name) === "svg" ? " (SVGs with scripts or embedded objects are not allowed)" : ""}. Check it opens, then try again.`);

/** Checks name, size, quota and count before any bytes are stored. */
export async function precheckMedia(siteId: string, rawName: string, size: number) {
  const name = cleanName(rawName);
  const rule = TYPES[extOf(name)];
  if (!rule) throw new MediaError(`Use one of ${MEDIA_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")}.`);
  if (size === 0) throw new MediaError("That file is empty.");
  if (size > rule.maxBytes) throw new MediaError(`That image is too big. The limit is ${rule.maxBytes >= 1024 * 1024 ? `${rule.maxBytes / 1024 / 1024} MB` : `${rule.maxBytes / 1024} KB`} for ${extOf(name).toUpperCase()}.`);
  const [usage] = await (await db()).media.aggregate<{ total: number; count: number }>([{ $match: { siteId } }, { $group: { _id: null, total: { $sum: "$size" }, count: { $sum: 1 } } }]).toArray();
  if ((usage?.count ?? 0) >= MAX_MEDIA_PER_SITE) throw new MediaError(`Your library is full (${MAX_MEDIA_PER_SITE} images). Delete some you no longer use.`);
  if ((usage?.total ?? 0) + size > MEDIA_QUOTA_BYTES) throw new MediaError("You've used all your image storage. Delete images you no longer use first.");
  return { name, rule };
}

async function record(input: { siteId: string; uploadedBy: string; id: string; name: string; size: number; mime: string; dims: Sniffed }): Promise<MediaItem> {
  const item: MediaItem = {
    id: input.id,
    siteId: input.siteId,
    name: input.name,
    alt: "",
    size: input.size,
    type: input.mime,
    ...(input.dims.width && input.dims.height ? { width: input.dims.width, height: input.dims.height } : {}),
    uploadedBy: input.uploadedBy,
    createdAt: new Date().toISOString(),
  };
  await (await db()).media.insertOne(toDoc(item));
  return item;
}

/** Local storage: the file came through our own route. */
export async function saveMediaUpload(input: { siteId: string; uploadedBy: string; file: File }): Promise<MediaItem> {
  const { name, rule } = await precheckMedia(input.siteId, input.file.name, input.file.size);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const dims = rule.read(bytes);
  if (!dims) throw badContents(name);
  const id = randomUUID();
  await blobStore().put(mediaKey(input.siteId, id), bytes);
  return record({ siteId: input.siteId, uploadedBy: input.uploadedBy, id, name, size: bytes.length, mime: rule.mime, dims });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The id in a client-chosen key, if the key is one this site may write. */
function idFromKey(siteId: string, key: string) {
  const prefix = mediaKey(siteId, "");
  const id = key.startsWith(prefix) ? key.slice(prefix.length) : "";
  return UUID.test(id) ? id : null;
}

/** Vercel Blob, step 0: picks a fresh key for this site after the prechecks. */
export async function newMediaKey(siteId: string, payload: { name: string; size: number }) {
  await precheckMedia(siteId, payload.name, payload.size);
  return mediaKey(siteId, randomUUID());
}

/** Vercel Blob, step 1: decides whether to issue an upload token for `key`. */
export async function authorizeMediaUpload(siteId: string, key: string, payload: { name: string; size: number }) {
  if (!idFromKey(siteId, key)) throw new MediaError("That upload isn't allowed.");
  await precheckMedia(siteId, payload.name, payload.size);
  return { maximumSizeInBytes: MAX_MEDIA_BYTES, allowedContentTypes: ["application/octet-stream"], addRandomSuffix: false, allowOverwrite: false };
}

/** Vercel Blob, step 2: checks what was actually stored and records it. Anything that fails is deleted. */
export async function finishMediaUpload(input: { siteId: string; uploadedBy: string; key: string; name: string }): Promise<MediaItem> {
  const id = idFromKey(input.siteId, input.key);
  if (!id) throw new MediaError("That upload isn't allowed.");
  const store = blobStore();
  const size = await store.size(input.key);
  if (size === null) throw new MediaError("The upload didn't finish. Try again.");
  if (await (await db()).media.findOne({ _id: id }, { projection: { _id: 1 } })) throw new MediaError("That image was already added.");
  try {
    const { name, rule } = await precheckMedia(input.siteId, input.name, size);
    const head = await store.readStart(input.key, extOf(name) === "svg" ? MAX_SVG_BYTES + 1 : SNIFF_BYTES);
    const dims = head && rule.read(head);
    if (!dims) throw badContents(name);
    return await record({ siteId: input.siteId, uploadedBy: input.uploadedBy, id, name, size, mime: rule.mime, dims });
  } catch (err) {
    if (err instanceof MediaError) await store.remove([input.key]).catch(() => undefined);
    throw err;
  }
}

export async function listMedia(siteId: string) {
  const docs = await (await db()).media.find({ siteId }).sort({ createdAt: -1 }).toArray();
  const items = docs.map((d) => fromDoc<MediaItem>(d));
  return { items, used: items.reduce((n, m) => n + m.size, 0), quota: MEDIA_QUOTA_BYTES };
}

export async function setMediaAlt(siteId: string, id: string, alt: string) {
  const res = await (await db()).media.updateOne({ _id: id, siteId }, { $set: { alt: alt.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ALT) } });
  return res.matchedCount > 0;
}

/**
 * Deletes an image, unless the published site still shows it: removing it would leave a broken picture
 * on the live page. Unpublished drafts can't be seen from here, so the editor warns about those.
 */
export async function deleteMedia(siteId: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await db();
  const site = await c.sites.findOne({ _id: siteId }, { projection: { blocks: 1, chrome: 1, pages: 1, courseTemplate: 1 } });
  if (site && mediaRefs({ blocks: site.blocks, chrome: site.chrome, pages: site.pages, courseTemplate: site.courseTemplate }).has(id)) return { ok: false, error: "This image is on your published site. Replace it there and publish first, then delete it." };
  const gone = await c.media.deleteOne({ _id: id, siteId });
  if (gone.deletedCount) await blobStore().remove([mediaKey(siteId, id)]).catch((err) => console.error("[kalaa media] couldn't remove bytes", err));
  return { ok: true };
}

/** Which of these library ids belong to the site. The editor sends paths, and a site may only show its own images. */
export async function ownedMediaIds(siteId: string, ids: Iterable<string>) {
  const list = [...ids];
  if (!list.length) return new Set<string>();
  const docs = await (await db()).media.find({ _id: { $in: list }, siteId }, { projection: { _id: 1 } }).toArray();
  return new Set(docs.map((d) => d._id));
}

/** Public read for the serving route. */
export async function readMedia(id: string) {
  const doc = await (await db()).media.findOne({ _id: id });
  if (!doc) return null;
  const object = await blobStore().read(mediaKey(doc.siteId, id));
  return object ? { type: doc.type, object } : null;
}

export function mediaResponse(file: { type: string }, object: { stream: ReadableStream<Uint8Array>; size: number }) {
  return new Response(object.stream, {
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(object.size),
      // Ids are never reused and the bytes never change, so browsers and the CDN may keep them for a year.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
