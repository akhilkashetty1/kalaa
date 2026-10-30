import "server-only";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { BlobStore } from ".";

// Development storage on local disk. Keys map to .data/files/<siteId>/<fileId>, the layout the app has
// always used, so files uploaded before the MongoDB move keep working.

const ROOT = path.join(process.cwd(), ".data", "files");

function pathOf(key: string) {
  const [, siteId, fileId] = key.split("/");
  if (!/^[0-9a-f-]{36}$/.test(siteId ?? "") || !/^[0-9a-f-]{36}$/.test(fileId ?? "")) throw new Error(`Bad storage key ${key}`);
  return path.join(ROOT, siteId, fileId);
}

const missing = (err: unknown) => (err as NodeJS.ErrnoException).code === "ENOENT";

export function localStore(): BlobStore {
  return {
    kind: "local",
    async put(key, bytes) {
      const file = pathOf(key);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, bytes, { mode: 0o600 });
    },
    async readStart(key, n) {
      try {
        const handle = await fs.open(pathOf(key), "r");
        try {
          const buf = Buffer.alloc(n);
          const { bytesRead } = await handle.read(buf, 0, n, 0);
          return buf.subarray(0, bytesRead);
        } finally {
          await handle.close();
        }
      } catch (err) {
        if (missing(err)) return null;
        throw err;
      }
    },
    async size(key) {
      try {
        return (await fs.stat(pathOf(key))).size;
      } catch (err) {
        if (missing(err)) return null;
        throw err;
      }
    },
    async read(key) {
      const size = await this.size(key);
      if (size === null) return null;
      return { size, stream: Readable.toWeb(createReadStream(pathOf(key))) as ReadableStream<Uint8Array> };
    },
    async remove(keys) {
      await Promise.all(keys.map((k) => fs.rm(pathOf(k), { force: true })));
    },
  };
}
