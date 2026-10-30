import type { Db } from "mongodb";
import m0001 from "./0001_collections_and_indexes";
import m0002 from "./0002_schema_validation";

export type Migration = {
  /** Sorts in apply order. Never rename or reorder one that has shipped. */
  id: string;
  description: string;
  up: (db: Db) => Promise<void>;
  down?: (db: Db) => Promise<void>;
};

// Add new migrations to the end of this list. `npm run db:new <name>` creates the file.
export const MIGRATIONS: Migration[] = [m0001, m0002];
