import type { AnyBulkWriteOperation, Collection, Document } from "mongodb";
import type { Announcement, AuditEntry, Course, Creator, Enrollment, Invite, Learner, Membership, Progress, Site, StoredFile } from "@/lib/types";
import { progressId, toDoc, type Collections } from "../collections";

// The content collections as plain arrays, the shape the seed and demo builders work on. Used only by
// scripts and development tooling, never by request handling: it loads whole collections into memory.

export type Dataset = {
  creators: Creator[];
  sites: Site[];
  courses: Course[];
  enrollments: Enrollment[];
  memberships: Membership[];
  invites: Invite[];
  audit: AuditEntry[];
  learners: Learner[];
  progress: Progress[];
  files: StoredFile[];
  announcements: Announcement[];
};

export const emptyDataset = (): Dataset => ({ creators: [], sites: [], courses: [], enrollments: [], memberships: [], invites: [], audit: [], learners: [], progress: [], files: [], announcements: [] });

type Keyed = Exclude<keyof Dataset, "progress">;
const KEYED: Keyed[] = ["creators", "sites", "courses", "enrollments", "memberships", "invites", "audit", "learners", "files", "announcements"];

export async function loadDataset(c: Collections): Promise<Dataset> {
  const data = emptyDataset();
  for (const name of KEYED) {
    const docs = await c[name].find().toArray();
    (data[name] as { id: string }[]) = docs.map(({ _id, _rev, ...rest }: Document) => (void _rev, { id: _id, ...rest }) as { id: string });
  }
  data.progress = (await c.progress.find().toArray()).map(({ _id, ...rest }) => (void _id, rest));
  return data;
}

/** Writes every record in `after` that is new or changed compared with `before`. Nothing is deleted. Returns how many were written. */
export async function writeDataset(c: Collections, after: Dataset, before: Dataset = emptyDataset()) {
  let written = 0;
  for (const name of KEYED) {
    const old = new Map((before[name] as { id: string }[]).map((x) => [x.id, JSON.stringify(x)]));
    const ops: AnyBulkWriteOperation<Document>[] = (after[name] as { id: string }[])
      .filter((x) => old.get(x.id) !== JSON.stringify(x))
      .map((x) => {
        const { _id, ...rest } = toDoc(x) as Document;
        return { updateOne: { filter: { _id }, update: { $set: rest }, upsert: true } };
      });
    if (ops.length) await (c[name] as unknown as Collection<Document>).bulkWrite(ops, { ordered: false });
    written += ops.length;
  }
  const oldProgress = new Map(before.progress.map((p) => [progressId(p.learnerId, p.courseId), JSON.stringify(p)]));
  const progressOps = after.progress
    .filter((p) => oldProgress.get(progressId(p.learnerId, p.courseId)) !== JSON.stringify(p))
    .map((p) => ({ updateOne: { filter: { _id: progressId(p.learnerId, p.courseId) }, update: { $set: p }, upsert: true } }));
  if (progressOps.length) await c.progress.bulkWrite(progressOps, { ordered: false });
  return written + progressOps.length;
}
