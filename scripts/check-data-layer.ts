// Concurrency checks for the data layer, run against a *_dev/_test database:
//   npm run db:check
// Needs the replica set from `npm run db:local`. Creates and removes its own records.
import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";

loadEnvConfig(process.cwd(), true);
let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? `  (${extra})` : ""}`);
  if (!ok) failures++;
};

async function main() {
  const { mongoConfig, closeMongo, mongoDb } = await import("@/server/db/client");
  const { assertSeedable } = await import("@/server/db/seed");
  assertSeedable(mongoConfig().dbName);
  const c = (await import("@/server/db/collections")).collectionsOf(mongoDb());
  const { issueCode, checkCode } = await import("@/server/otp");
  const { takeToken } = await import("@/server/rate-limit");
  const { recordProgress, getProgress } = await import("@/server/data/progress");
  const { inviteMember, acceptInvite, removeMember } = await import("@/server/team");
  const { createSite } = await import("@/server/data/sites");

  // OTP: 20 parallel wrong guesses may use at most 5 attempts, and a correct code works once.
  const email = `otp-${randomUUID()}@example.com`;
  const issued = await issueCode("creator", email);
  if (!issued.ok) throw new Error("issue failed");
  const wrong = await Promise.all(Array.from({ length: 20 }, () => checkCode("creator", email, "000000")));
  check("OTP: parallel guesses are capped at 5 attempts", wrong.filter((r) => r === "invalid" || (r === "locked")).length === 20 && (await c.loginCodes.findOne({ email }))!.attempts === 5);
  const email2 = `otp-${randomUUID()}@example.com`;
  const i2 = await issueCode("creator", email2);
  if (!i2.ok) throw new Error("issue failed");
  const winners = (await Promise.all(Array.from({ length: 5 }, () => checkCode("creator", email2, i2.code)))).filter((r) => r === "ok");
  check("OTP: a correct code succeeds exactly once", winners.length === 1, `${winners.length} succeeded`);

  // Rate limit: 10 parallel takes against a limit of 3.
  const subject = randomUUID();
  const taken = (await Promise.all(Array.from({ length: 10 }, () => takeToken("check", subject, 3, 60_000)))).filter(Boolean).length;
  check("Rate limit: exactly 3 of 10 parallel requests allowed", taken === 3, `${taken} allowed`);

  // Progress: parallel lesson completions must all be kept.
  const ids = { siteId: randomUUID(), learnerId: randomUUID(), courseId: randomUUID() };
  await Promise.all(Array.from({ length: 12 }, (_, i) => recordProgress({ ...ids, lesson: `lesson-${i}`, complete: true })));
  const p = await getProgress(ids.siteId, ids.learnerId, ids.courseId);
  check("Progress: 12 parallel completions all recorded", p.completed.size === 12, `${p.completed.size} kept`);
  await c.progress.deleteMany({ siteId: ids.siteId });

  // Sites: two creators racing for one slug make exactly one site.
  const owners = await Promise.all([0, 1].map(async () => {
    const id = randomUUID();
    await c.creators.insertOne({ _id: id, email: `o-${id}@example.com`, name: "Owner", createdAt: new Date().toISOString() });
    return id;
  }));
  const slug = `race-${randomUUID().slice(0, 8)}`;
  const results = await Promise.allSettled(owners.map((ownerId) => createSite({ ownerId, slug, name: "Race", creatorName: "Owner", template: "exam" })));
  check("Sites: duplicate slug is rejected", results.filter((r) => r.status === "fulfilled").length === 1);
  const winner = (await c.sites.findOne({ slug }))!;

  // Team: invite, accept, then remove in a race with the member's own invite.
  const ownerId = winner.ownerId;
  const helper = randomUUID();
  const helperEmail = `h-${helper}@example.com`;
  await c.creators.insertOne({ _id: helper, email: helperEmail, name: "Helper", createdAt: new Date().toISOString() });
  const invite = await inviteMember({ siteId: winner._id, actorId: ownerId, email: helperEmail, role: "coowner" });
  const twice = await Promise.allSettled([acceptInvite(invite.token, helper), acceptInvite(invite.token, helper)]);
  check("Team: an invitation is used once", twice.filter((r) => r.status === "fulfilled").length === 1 && (await c.memberships.countDocuments({ siteId: winner._id, creatorId: helper })) === 1);
  const sent = await Promise.allSettled([1, 2, 3].map((n) => inviteMember({ siteId: winner._id, actorId: ownerId, email: `dup@example.com`, role: "editor" }).then((r) => (void n, r))));
  check("Team: parallel invites to one address make one invitation", sent.filter((r) => r.status === "fulfilled").length === 1 && (await c.invites.countDocuments({ siteId: winner._id, email: "dup@example.com" })) === 1);
  await removeMember({ siteId: winner._id, actorId: ownerId, creatorId: helper });
  const late = await Promise.allSettled([inviteMember({ siteId: winner._id, actorId: helper, email: "late@example.com", role: "editor" })]);
  check("Team: a removed member can't invite anyone", late[0].status === "rejected");

  // Clean up.
  await c.sites.deleteOne({ _id: winner._id });
  await c.memberships.deleteMany({ siteId: winner._id });
  await c.invites.deleteMany({ siteId: winner._id });
  await c.audit.deleteMany({ siteId: winner._id });
  await c.creators.deleteMany({ _id: { $in: [...owners, helper] } });
  await c.loginCodes.deleteMany({ email: { $in: [email, email2] } });
  await closeMongo();
  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
