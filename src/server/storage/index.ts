import "server-only";
import { localStore } from "./local";
import { vercelBlobStore } from "./vercel-blob";

// Where uploaded file bytes live. MongoDB keeps the record (name, size, owner); a BlobStore keeps the bytes.
//
// - "local": files on this machine's disk, under STORAGE_DIR (default .data/files). For development and for
//   running on your own server. Not on Vercel: its filesystem is read-only and every function instance has its own.
// - "vercel-blob": a private Vercel Blob store. Browsers upload straight to it (Vercel functions accept at
//   most 4.5 MB per request), and downloads stream through our routes after the access check.
//
// STORAGE_DRIVER picks one explicitly; otherwise a configured Blob store wins, then local disk outside production.

export type StoredObject = { stream: ReadableStream<Uint8Array>; size: number };

export interface BlobStore {
  kind: "local" | "vercel-blob";
  /** Server-side write. Only the local store accepts uploads through our own route. */
  put(key: string, bytes: Buffer): Promise<void>;
  /** The first `n` bytes, to check what a client-uploaded file really is. Null if it doesn't exist. */
  readStart(key: string, n: number): Promise<Buffer | null>;
  size(key: string): Promise<number | null>;
  read(key: string): Promise<StoredObject | null>;
  remove(keys: string[]): Promise<void>;
}

/** Object key for a lesson attachment. */
export const fileKey = (siteId: string, fileId: string) => `lesson-files/${siteId}/${fileId}`;

let chosen: BlobStore | undefined;

export function blobStore(): BlobStore {
  if (chosen) return chosen;
  const driver = process.env.STORAGE_DRIVER || (process.env.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : "local");
  if (driver === "vercel-blob") chosen = vercelBlobStore();
  else if (driver === "local") {
    if (process.env.VERCEL) throw new Error("Local file storage doesn't work on Vercel. Connect a private Blob store (README → File storage).");
    chosen = localStore();
  } else throw new Error(`Unknown STORAGE_DRIVER "${driver}". Use "local" or "vercel-blob".`);
  return chosen;
}
