import "server-only";
import { randomUUID } from "node:crypto";
import type { AuditAction, Creator, Site } from "@/lib/types";
import type { Tx } from "@/server/db";

const AUDIT_PER_SITE = 300;

/** Appends to the site's activity log, keeping the newest 300 entries per site. Call inside the transaction that made the change. */
export async function recordAudit({ c, session }: Tx, site: Pick<Site, "id">, actor: Pick<Creator, "id" | "email">, action: AuditAction, detail: string) {
  await c.audit.insertOne({ _id: randomUUID(), siteId: site.id, actorId: actor.id, actorEmail: actor.email, action, detail, at: new Date().toISOString() }, { session });
  const oldestKept = await c.audit.find({ siteId: site.id }, { session, projection: { at: 1 } }).sort({ at: -1 }).skip(AUDIT_PER_SITE - 1).limit(1).next();
  if (oldestKept) await c.audit.deleteMany({ siteId: site.id, at: { $lt: oldestKept.at } }, { session });
}
