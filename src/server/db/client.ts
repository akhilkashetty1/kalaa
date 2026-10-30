import { attachDatabasePool } from "@vercel/functions";
import { MongoClient, type Db } from "mongodb";

// The MongoDB connection. No Next.js imports, so the migration and seed scripts share it with the app.
//
// One MongoClient (and so one connection pool) per process. Next's dev server reloads modules, so the
// client lives on globalThis. On Vercel, attachDatabasePool lets Fluid compute close idle connections
// before an instance is suspended, so pools don't pile up against the Atlas connection limit.

const g = globalThis as unknown as { __kalaaMongo?: MongoClient };

export function mongoConfig() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local (see README → Database).");
  // Separate databases per environment (kalaa_dev, kalaa_preview, kalaa) so a preview deploy never touches production data.
  const dbName = process.env.MONGODB_DB || "kalaa_dev";
  return { uri, dbName };
}

export function mongoClient(): MongoClient {
  if (g.__kalaaMongo) return g.__kalaaMongo;
  const { uri } = mongoConfig();
  const client = new MongoClient(uri, {
    appName: "kalaa",
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 10,
    // Release idle sockets quickly: serverless instances come and go.
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 8_000,
    // Optional fields set to undefined are left out instead of being stored as null.
    ignoreUndefined: true,
  });
  if (process.env.VERCEL) attachDatabasePool(client);
  g.__kalaaMongo = client;
  return client;
}

/** The database handle. The driver connects lazily on the first operation. */
export function mongoDb(): Db {
  return mongoClient().db(mongoConfig().dbName);
}

/** For scripts: closes the pool so the process can exit. */
export async function closeMongo() {
  await g.__kalaaMongo?.close();
  g.__kalaaMongo = undefined;
}
