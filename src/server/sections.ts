import "server-only";
import { randomUUID } from "node:crypto";
import { dropForeignMedia, mediaRefs } from "@/lib/media";
import { sanitizeCustom } from "@/lib/custom";
import type { SavedSection } from "@/lib/types";
import { db, fromDoc, toDoc } from "@/server/db";
import { UserError } from "@/server/errors";
import { ownedMediaIds } from "@/server/media";

// A teacher's own library of custom sections: build one once, save it, insert a copy on any page.
// A saved section is a validated snapshot, so inserting it never depends on anything that can change.

export class SectionError extends UserError {}

export const MAX_SAVED_SECTIONS = 30;

export async function listSavedSections(siteId: string) {
  const docs = await (await db()).savedSections.find({ siteId }).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => fromDoc<SavedSection>(d));
}

export async function saveSection(input: { siteId: string; createdBy: string; name: string; props: unknown }): Promise<SavedSection> {
  const name = input.name.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!name) throw new SectionError("Give the section a name.");
  const c = await db();
  if ((await c.savedSections.countDocuments({ siteId: input.siteId })) >= MAX_SAVED_SECTIONS) throw new SectionError(`You can save up to ${MAX_SAVED_SECTIONS} sections. Delete one you no longer use.`);
  const clean = sanitizeCustom(input.props);
  // Only this site's own library images may be inside a saved section.
  const owned = await ownedMediaIds(input.siteId, mediaRefs(clean));
  const section: SavedSection = { id: randomUUID(), siteId: input.siteId, name, props: dropForeignMedia(clean, owned) as unknown as Record<string, unknown>, createdBy: input.createdBy, createdAt: new Date().toISOString() };
  await c.savedSections.insertOne(toDoc(section));
  return section;
}

export async function deleteSavedSection(siteId: string, id: string) {
  return ((await (await db()).savedSections.deleteOne({ _id: id, siteId })).deletedCount ?? 0) > 0;
}
