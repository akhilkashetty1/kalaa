import "server-only";
import { BlobNotFoundError, del, get, head, put } from "@vercel/blob";
import type { BlobStore } from ".";

// A private Vercel Blob store. Nothing in it has a public URL: every read goes through our routes, which
// check access first. Authentication comes from the environment (OIDC on Vercel, or BLOB_READ_WRITE_TOKEN,
// which client uploads also need).

const notFound = (err: unknown) => err instanceof BlobNotFoundError;

export function vercelBlobStore(): BlobStore {
  return {
    kind: "vercel-blob",
    async put(key, bytes) {
      await put(key, bytes, { access: "private", addRandomSuffix: false, contentType: "application/octet-stream" });
    },
    async readStart(key, n) {
      const res = await get(key, { access: "private", useCache: false });
      if (res?.statusCode !== 200) return null;
      const reader = res.stream.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        while (total < n) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          total += value.length;
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      return Buffer.concat(chunks).subarray(0, n);
    },
    async size(key) {
      try {
        return (await head(key)).size;
      } catch (err) {
        if (notFound(err)) return null;
        throw err;
      }
    },
    async read(key) {
      const res = await get(key, { access: "private" });
      if (res?.statusCode !== 200) return null;
      return { stream: res.stream, size: res.blob.size };
    },
    async remove(keys) {
      if (keys.length) await del(keys);
    },
  };
}
