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

  // Leads: the form's settings come from the published site; bots, bad input and floods are refused.
  const { submitLead, LeadError } = await import("@/server/leads");
  const { emptyCustom, newEl } = await import("@/lib/custom");
  const form = newEl("form", { consent: "I agree to be contacted", phoneRequired: true, questions: [{ label: "Exam", required: true }] });
  const fakeSite = { id: randomUUID(), ownerId: randomUUID(), blocks: [{ id: "bk_formtest", type: "custom", props: { ...emptyCustom("1"), cols: [[form]] } }] } as never;
  const good = { formId: form.id, values: { name: "Asha", email: `lead-${randomUUID()}@example.com`, phone: "98765 43210", answers: { "0": "JEE" } }, consent: true, hp: "", elapsed: 5000, path: "/" };
  const lead = (extra: Record<string, unknown> = {}, ip = randomUUID()) => submitLead(fakeSite, { ...good, ...extra, values: { ...good.values, email: `lead-${randomUUID()}@example.com`, ...((extra.values as object) ?? {}) } } as never, ip);
  const refused = async (extra: Record<string, unknown>) => lead(extra).then(() => false, (e) => e instanceof LeadError);
  const count = () => c.leads.countDocuments({ siteId: (fakeSite as { id: string }).id });
  await lead();
  check("Leads: a valid submission is stored (phone cleaned)", (await count()) === 1 && (await c.leads.findOne({ siteId: (fakeSite as { id: string }).id }))!.phone === "9876543210");
  const before = await count();
  await lead({ hp: "http://spam.example" });
  await lead({ elapsed: 200 });
  check("Leads: a filled honeypot or an instant submit is dropped quietly", (await count()) === before);
  check("Leads: unknown form id is refused", await refused({ formId: "el_nope" }));
  check("Leads: missing name / bad email / missing required phone are refused", (await refused({ values: { name: "" } })) && (await refused({ values: { email: "not-an-email" } })) && (await refused({ values: { phone: "" } })));
  check("Leads: unticked consent and unanswered required question are refused", (await refused({ consent: false })) && (await refused({ values: { answers: {} } })));
  const sameEmail = `flood-${randomUUID()}@example.com`;
  const sends = [] as boolean[];
  for (let i = 0; i < 4; i++) sends.push(await submitLead(fakeSite, { ...good, values: { ...good.values, email: sameEmail } } as never, randomUUID()).then(() => true, () => false));
  check("Leads: one email can submit 3 times a day", sends.join() === "true,true,true,false", sends.join());
  const oneIp = randomUUID();
  const ipSends = [] as boolean[];
  for (let i = 0; i < 9; i++) ipSends.push(await lead({}, oneIp).then(() => true, () => false));
  check("Leads: one address can submit 8 times an hour", ipSends.filter(Boolean).length === 8 && ipSends[8] === false, ipSends.filter(Boolean).length + " ok");
  await c.leads.deleteMany({ siteId: (fakeSite as { id: string }).id });

  // Publishing: drafts are validated, versions are kept, scheduled publishes run once and only when due.
  const pub = await import("@/server/publish");
  const { newBlock } = await import("@/lib/blocks");
  const pubOwner = randomUUID();
  await c.creators.insertOne({ _id: pubOwner, email: `pub-${pubOwner}@example.com`, name: "Pub", createdAt: new Date().toISOString() });
  const psite = await createSite({ ownerId: pubOwner, slug: `pub-${randomUUID().slice(0, 8)}`, name: "Pub", creatorName: "Pub", template: "exam" });
  const draft = (over: Record<string, unknown> = {}) => ({ name: "Pub site", theme: psite.theme, blocks: [newBlock("hero")], chrome: {}, pages: [], courseTemplate: [], ...over });
  const rejects = (fn: () => Promise<unknown>) => fn().then(() => false, (e) => e instanceof pub.PublishError);
  check("Publish: a draft with no name or no visible section is refused", (await rejects(() => pub.buildSnapshot(psite, draft({ name: "  " })))) && (await rejects(() => pub.buildSnapshot(psite, draft({ blocks: [{ ...newBlock("hero"), hidden: true }] })))));
  const foreign = `/api/media/${randomUUID()}`;
  const built = await pub.buildSnapshot(psite, draft({ blocks: [newBlock("about", { imageUrl: foreign })] }));
  check("Publish: another site's library image is stripped", (built.blocks[0].props as Record<string, unknown>).imageUrl === "");

  for (let i = 0; i < 33; i++) await pub.applySnapshot(psite, await pub.buildSnapshot(psite, draft({ name: `v${i}` })), "t@example.com");
  const versions = await pub.listVersions(psite.id);
  check("Versions: only the newest 30 are kept, newest first", versions.length === 30 && (await pub.getVersion(psite.id, versions[0].id))!.snapshot.name === "v32", String(versions.length));

  const later = (mins: number) => new Date(Date.now() + mins * 60000);
  const snap = await pub.buildSnapshot(psite, draft({ name: "Scheduled name" }));
  check("Schedule: a past time and a time over 90 days away are refused", (await rejects(() => pub.scheduleSnapshot(psite, snap, later(-5), "t"))) && (await rejects(() => pub.scheduleSnapshot(psite, snap, later(60 * 24 * 100), "t"))));
  const schedIds = [] as string[];
  for (let i = 0; i < 5; i++) schedIds.push(await pub.scheduleSnapshot(psite, snap, later(60 + i), "t"));
  check("Schedule: at most 5 pending at a time", await rejects(() => pub.scheduleSnapshot(psite, snap, later(90), "t")));
  check("Schedule: nothing is published before its time", (await pub.applyDueSchedules(psite.id)) === 0 && (await c.sites.findOne({ _id: psite.id }))!.name !== "Scheduled name");
  check("Schedule: a pending one can be cancelled once", (await pub.cancelSchedule(psite.id, schedIds[4])) === true && (await pub.cancelSchedule(psite.id, schedIds[4])) === false);
  await c.scheduledPublishes.updateMany({ siteId: psite.id }, { $set: { at: new Date(Date.now() - 60000).toISOString() } });
  const runs = await Promise.all([pub.applyDueSchedules(psite.id), pub.applyDueSchedules(psite.id), pub.applyDueSchedules(psite.id)]);
  check("Schedule: parallel runs publish each due item exactly once", runs.reduce((a, b) => a + b, 0) === 4, runs.join("+"));
  check("Schedule: published items are cleared and recorded as versions", (await c.scheduledPublishes.countDocuments({ siteId: psite.id })) === 0 && (await pub.listVersions(psite.id))[0].label === "Scheduled publish");
  await c.sites.deleteOne({ _id: psite.id });
  await c.siteVersions.deleteMany({ siteId: psite.id });
  await c.scheduledPublishes.deleteMany({ siteId: psite.id });
  await c.creators.deleteOne({ _id: pubOwner });

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
