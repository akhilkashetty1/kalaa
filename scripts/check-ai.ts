// Checks the AI first-draft path against a local stand-in for the Anthropic API (no key, no cost):
//   npm run check:ai
// It verifies the request the SDK really sends (model, no sampling params, effort, prompts, headers) and how each
// kind of reply or failure is handled. It cannot judge the quality of real model output.
import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

loadEnvConfig(process.cwd(), true);
let failures = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};

const GOOD = {
  headline: "Physics that finally makes *sense*",
  intro: "Concept-first lessons for JEE and NEET students who are tired of memorising formulas.",
  about: "Ishaan teaches physics for competitive exams, starting from the idea and moving to the formula.",
  featuresTitle: "Why students stay",
  features: [{ icon: "✦", title: "Short lessons", text: "Ten minutes at a time." }, { icon: "◎", title: "Doubt nights", text: "Ask live." }, { icon: "↗", title: "Daily practice", text: "A quick quiz." }, { icon: "☰", title: "Mock tests", text: "With solutions." }],
  faqTitle: "Questions",
  faq: [{ q: "Can I try first?", a: "Yes, free lessons are open." }, { q: "How do I pay?", a: "By UPI after you reserve a seat." }, { q: "Are classes recorded?", a: "The teacher will confirm." }, { q: "Which exams?", a: "JEE and NEET." }],
  ctaHeadline: "Ready when *you* are",
  ctaBody: "Start with a free lesson.",
  ctaLabel: "Start free",
};

async function main() {
  const seen: { path?: string; headers?: http.IncomingHttpHeaders; body?: Record<string, unknown> } = {};
  let mode = "good";
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.path = req.url;
      seen.headers = req.headers;
      seen.body = raw ? JSON.parse(raw) : {};
      const reply = (status: number, body: unknown) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      const message = (text: string, stop = "end_turn") => reply(200, { id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text }], stop_reason: stop, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } });
      if (mode === "good") return message("Here you go:\n```json\n" + JSON.stringify(GOOD) + "\n```");
      if (mode === "garbage") return message("Sorry, I can't do that.");
      if (mode === "refusal") return reply(200, { id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: null, explanation: null }, usage: { input_tokens: 10, output_tokens: 0 } });
      if (mode === "401") return reply(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
      if (mode === "429") return reply(429, { type: "error", error: { type: "rate_limit_error", message: "slow down" } });
      return reply(500, { type: "error", error: { type: "api_error", message: "boom" } });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "sk-test-key";
  delete process.env.ANTHROPIC_MODEL;

  const { draftCopy, AiError, aiEnabled } = await import("@/server/ai");
  const { closeMongo } = await import("@/server/db/client");
  const site = () => ({ siteId: randomUUID(), siteName: "The Physics Room", teacher: "Ishaan Mehra", description: "I teach JEE and NEET physics. Concept first, then formulas, for class 11 and 12 students who find physics confusing.", language: "en" as const });
  const fails = async (input: ReturnType<typeof site>) => draftCopy(input).then(() => null, (e) => e);

  ok("enabled only when a key is set", aiEnabled() === true);
  const copy = await draftCopy(site());
  ok("a fenced JSON reply is parsed into copy", copy.headline.includes("*sense*") && copy.features.length === 4 && copy.faq.length === 4);

  const b = seen.body!;
  ok("request goes to /v1/messages with the key and API version", seen.path === "/v1/messages" && (seen.headers?.["x-api-key"] === "sk-test-key" || seen.headers?.authorization === "Bearer sk-test-key") && Boolean(seen.headers?.["anthropic-version"]), `${seen.path} | headers: ${Object.keys(seen.headers ?? {}).filter((k) => /key|auth|anthropic/.test(k)).join(",")}`);
  ok("uses claude-opus-5-5 by default", b.model === "claude-opus-5-5");
  ok("sends no sampling parameters (rejected by current models) and no thinking override", !("temperature" in b) && !("top_p" in b) && !("top_k" in b) && !("thinking" in b));
  ok("uses low effort and a roomy max_tokens", (b.output_config as { effort?: string })?.effort === "low" && Number(b.max_tokens) >= 16000);
  ok("the system prompt forbids inventing facts and the user turn carries the description", String(b.system).includes("NEVER invent") && JSON.stringify(b.messages).includes("concept first") === false && JSON.stringify(b.messages).includes("Concept first"));
  ok("no assistant prefill is sent", (b.messages as { role: string }[]).every((m) => m.role === "user"));

  process.env.ANTHROPIC_MODEL = "claude-sonnet-5-5";
  await draftCopy(site());
  ok("ANTHROPIC_MODEL overrides the default", seen.body!.model === "claude-sonnet-5-5");
  delete process.env.ANTHROPIC_MODEL;

  mode = "garbage";
  ok("an unusable reply is a friendly error, not copy", (await fails(site())) instanceof AiError);
  mode = "refusal";
  ok("a refusal is a friendly error", ((await fails(site())) as Error)?.message.includes("couldn't write this one"));
  mode = "401";
  const e401 = (await fails(site())) as Error;
  ok("a rejected key says so without leaking it", e401 instanceof AiError && !e401.message.includes("sk-test-key") && e401.message.includes("isn't set up correctly"));
  mode = "429";
  ok("rate limiting by the provider is a friendly error", ((await fails(site())) as Error)?.message.includes("busy"));
  mode = "500";
  ok("a provider failure is a friendly error", (await fails(site())) instanceof AiError);

  mode = "good";
  const short = { ...site(), description: "physics" };
  ok("a too-short description is refused before any call", ((await fails(short)) as Error)?.message.includes("a little more"));
  const one = site();
  for (let i = 0; i < 6; i++) await draftCopy(one);
  ok("a site can draft 6 times an hour", ((await fails(one)) as Error)?.message.includes("several times this hour"));

  delete process.env.ANTHROPIC_API_KEY;
  ok("without a key it reports itself disabled", aiEnabled() === false && ((await fails(site())) as Error)?.message.includes("aren't set up"));

  server.close();
  await closeMongo();
  console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
  process.exitCode = failures ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
