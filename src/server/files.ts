import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Lesson, LessonFile } from "@/lib/types";
import { db } from "@/server/db";
import { blobStore, fileKey } from "@/server/storage";

// Lesson attachments. MongoDB keeps each file's record; the bytes live in a BlobStore (server/storage).
// Every upload is checked against an allowlist of types by its real contents, not its name, and capped
// per file and per site. Nothing here serves a file: access is decided by the download routes.
//
// Two upload paths end in the same checks:
// - local storage: the browser posts the file to /api/studio/upload (saveUpload).
// - Vercel Blob: the browser uploads straight to the store with a short-lived token scoped to one key
//   (authorizeClientUpload), then asks us to record it (finishClientUpload), which reads the stored bytes
//   back to check them and deletes anything that fails.

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const SITE_QUOTA_BYTES = 500 * 1024 * 1024;
const ORPHAN_AFTER_MS = 24 * 60 * 60 * 1000;
const SNIFF_BYTES = 4096;

export class UploadError extends Error {}

const startsWith = (b: Buffer, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const isText = (b: Buffer) => !b.subarray(0, 4096).includes(0);

/** Allowed extensions, the MIME type we will serve them as, and a check of the file's first bytes. */
const TYPES: Record<string, { mime: string; ok: (b: Buffer) => boolean }> = {
  pdf: { mime: "application/pdf", ok: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  png: { mime: "image/png", ok: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]) },
  jpg: { mime: "image/jpeg", ok: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  jpeg: { mime: "image/jpeg", ok: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  webp: { mime: "image/webp", ok: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8) },
  zip: { mime: "application/zip", ok: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ok: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ok: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ok: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  doc: { mime: "application/msword", ok: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]) },
  ppt: { mime: "application/vnd.ms-powerpoint", ok: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]) },
  xls: { mime: "application/vnd.ms-excel", ok: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]) },
  txt: { mime: "text/plain; charset=utf-8", ok: isText },
  csv: { mime: "text/csv; charset=utf-8", ok: isText },
};
export const ALLOWED_EXTENSIONS = Object.keys(TYPES);

/** A safe display name: no folders, no control characters, bounded length. */
export function cleanName(raw: string) {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "";
  const name = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim();
  return (name || "file").slice(-120);
}

const extOf = (name: string) => path.extname(name).slice(1).toLowerCase();

export function referencedFileIds(lessons: Lesson[]) {
  return new Set(lessons.flatMap((l) => (l.files ?? []).map((f) => f.id)));
}

/** Checks the name, size and site quota before any bytes are stored. Returns the clean name and how the file will be served. */
export async function precheck(siteId: string, rawName: string, size: number) {
  const name = cleanName(rawName);
  const type = TYPES[extOf(name)];
  if (!type) throw new UploadError(`That file type isn't allowed. Use ${ALLOWED_EXTENSIONS.map((e) => e.toUpperCase()).join(", ")}.`);
  if (size === 0) throw new UploadError("That file is empty.");
  if (size > MAX_FILE_BYTES) throw new UploadError(`That file is too big. The limit is ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  const [usage] = await (await db()).files.aggregate<{ total: number }>([{ $match: { siteId } }, { $group: { _id: null, total: { $sum: "$size" } } }]).toArray();
  if ((usage?.total ?? 0) + size > SITE_QUOTA_BYTES) throw new UploadError("You've used all your file storage. Remove files you no longer need first.");
  return { name, type };
}

const badContents = (name: string) => new UploadError(`That doesn't look like a real ${extOf(name).toUpperCase()} file. Check it opens, then try again.`);

async function record(input: { siteId: string; uploadedBy: string; id: string; name: string; size: number; mime: string }): Promise<LessonFile> {
  const meta: LessonFile = { id: input.id, name: input.name, size: input.size, type: input.mime };
  await (await db()).files.insertOne({ _id: meta.id, name: meta.name, size: meta.size, type: meta.type, siteId: input.siteId, uploadedBy: input.uploadedBy, createdAt: new Date().toISOString() });
  void sweepOrphans(input.siteId).catch((err) => console.error("[kalaa files] orphan sweep failed", err)); // housekeeping, never blocks the upload
  return meta;
}

/** Local storage: the file came through our own route. */
export async function saveUpload(input: { siteId: string; uploadedBy: string; file: File }): Promise<LessonFile> {
  const { name, type } = await precheck(input.siteId, input.file.name, input.file.size);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  if (!type.ok(bytes)) throw badContents(name);
  const id = randomUUID();
  await blobStore().put(fileKey(input.siteId, id), bytes);
  return record({ siteId: input.siteId, uploadedBy: input.uploadedBy, id, name, size: bytes.length, mime: type.mime });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The file id in a client-chosen key, if the key is one this site may write. */
function idFromKey(siteId: string, key: string) {
  const prefix = fileKey(siteId, "");
  const id = key.startsWith(prefix) ? key.slice(prefix.length) : "";
  return UUID.test(id) ? id : null;
}

/** Vercel Blob, step 1: decides whether to issue an upload token for `key`. Runs before any bytes move. */
export async function authorizeClientUpload(siteId: string, key: string, payload: { name: string; size: number }) {
  if (!idFromKey(siteId, key)) throw new UploadError("That upload isn't allowed.");
  await precheck(siteId, payload.name, payload.size);
  return { maximumSizeInBytes: MAX_FILE_BYTES, allowedContentTypes: ["application/octet-stream"], addRandomSuffix: false, allowOverwrite: false };
}

/** Vercel Blob, step 2: checks what was actually stored and records it. Anything that fails is deleted. */
export async function finishClientUpload(input: { siteId: string; uploadedBy: string; key: string; name: string }): Promise<LessonFile> {
  const id = idFromKey(input.siteId, input.key);
  if (!id) throw new UploadError("That upload isn't allowed.");
  const store = blobStore();
  const size = await store.size(input.key);
  if (size === null) throw new UploadError("The upload didn't finish. Try again.");
  try {
    if (await (await db()).files.findOne({ _id: id }, { projection: { _id: 1 } })) throw new UploadError("That file was already added.");
    const { name, type } = await precheck(input.siteId, input.name, size);
    const head = await store.readStart(input.key, SNIFF_BYTES);
    if (!head || !type.ok(head)) throw badContents(name);
    return await record({ siteId: input.siteId, uploadedBy: input.uploadedBy, id, name, size, mime: type.mime });
  } catch (err) {
    if (err instanceof UploadError && err.message !== "That file was already added.") await store.remove([input.key]).catch(() => undefined);
    throw err;
  }
}

export async function readStored(siteId: string, id: string) {
  const doc = await (await db()).files.findOne({ _id: id, siteId });
  if (!doc) return null;
  const object = await blobStore().read(fileKey(siteId, id));
  return object ? { meta: { id: doc._id, name: doc.name, size: doc.size, type: doc.type }, object } : null;
}

/** Deletes the bytes for files that are no longer used. The database records are removed where the lesson changes. */
export async function removeFiles(siteId: string, ids: string[]) {
  await blobStore().remove(ids.map((id) => fileKey(siteId, id)));
}

/** Uploads that were never attached to a saved lesson are cleared after a day. */
export async function sweepOrphans(siteId: string) {
  const c = await db();
  const cutoff = new Date(Date.now() - ORPHAN_AFTER_MS).toISOString();
  const used = new Set((await c.courses.distinct("lessons.files.id", { siteId })) as string[]);
  const old = await c.files.find({ siteId, createdAt: { $lt: cutoff } }, { projection: { _id: 1 } }).toArray();
  const dead = old.map((f) => f._id).filter((id) => !used.has(id));
  if (!dead.length) return;
  await c.files.deleteMany({ _id: { $in: dead }, siteId });
  await removeFiles(siteId, dead);
}

/**
 * Whether this person may download the file. Files on a free-preview lesson are open to everyone; any other
 * lesson's files need a confirmed payment for the course. Anything else looks like "not found".
 */
export async function canDownload(siteId: string, fileId: string, learnerEmail: string | null) {
  const c = await db();
  const course = await c.courses.findOne({ siteId, "lessons.files.id": fileId }, { projection: { lessons: 1, published: 1 } });
  if (!course) return false;
  const lesson = course.lessons.find((l) => l.files?.some((f) => f.id === fileId))!;
  if (learnerEmail && (await c.enrollments.countDocuments({ siteId, courseId: course._id, email: learnerEmail, status: "paid" }, { limit: 1 }))) return true;
  return lesson.free && course.published;
}

const asciiName = (n: string) => n.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");

/** Streams the file with headers that keep it from being run in the page: never sniffed, never cached. PDFs open inline; everything else downloads. */
export function fileResponse(file: { name: string; type: string }, object: { stream: ReadableStream<Uint8Array>; size: number }, forceDownload: boolean) {
  const inline = file.type === "application/pdf" && !forceDownload;
  return new Response(object.stream, {
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(object.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName(file.name)}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
