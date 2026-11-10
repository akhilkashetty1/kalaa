import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI_LIMITS, parseCopy, type AiCopy } from "@/lib/ai-copy";
import { UserError } from "@/server/errors";
import { takeToken } from "@/server/rate-limit";

// Calls Claude to draft website copy through the official SDK. Needs ANTHROPIC_API_KEY (optionally
// ANTHROPIC_MODEL, and ANTHROPIC_BASE_URL which the SDK reads itself). The key stays on the server, calls are rate limited per site, and only the validated copy (lib/ai-copy.ts) is
// ever returned: never the model's raw text.

export class AiError extends UserError {}

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const SYSTEM = `You write website copy for independent teachers and coaches in India. Reply with ONLY one JSON object, no other text, no markdown.

Rules:
- Plain, warm, specific language a student or parent understands. No hype, no buzzwords.
- NEVER invent facts: no student numbers, results, ranks, awards, ratings, testimonials, years of experience or institutions. Use only what the teacher told you. If they didn't say it, don't claim it.
- In headline and ctaHeadline you may wrap ONE key word in *stars* to highlight it, like: Physics that finally makes *sense*.
- Keep every field within its limit.

JSON shape:
{
  "headline": string (max 90),
  "intro": string (max 240, what they teach, who it is for, the benefit),
  "about": string (max 600, written about the teacher in the third person, only from the facts given),
  "featuresTitle": string (max 60),
  "features": [ { "icon": "one symbol character", "title": string (max 40), "text": string (max 160) } ] (exactly 4),
  "faqTitle": string (max 50),
  "faq": [ { "q": string (max 100), "a": string (max 300) } ] (exactly 4, practical questions a student would ask; if an answer needs a fact you don't have, answer honestly in general terms or say the teacher will confirm),
  "ctaHeadline": string (max 80),
  "ctaBody": string (max 160),
  "ctaLabel": string (max 24)
}`;

export type DraftInput = { siteId: string; siteName: string; teacher: string; description: string; language: "en" | "hi" };

export async function draftCopy(input: DraftInput): Promise<AiCopy> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError("AI drafts aren't set up on this server.");
  const description = input.description.replace(/\s+/g, " ").trim().slice(0, AI_LIMITS.description);
  if (description.length < AI_LIMITS.minDescription) throw new AiError("Tell us a little more: what you teach, who it is for and what makes your classes different.");
  if (!(await takeToken("ai-site", input.siteId, 6, 60 * 60 * 1000))) throw new AiError("You've used the AI draft several times this hour. Try again later, or edit the text by hand.");

  const language = input.language === "hi" ? "Hindi (Devanagari script), natural and conversational" : "English (Indian English spelling, simple words)";
  const user = `Write the website copy in ${language}.\n\nSite name: ${input.siteName}\nTeacher: ${input.teacher}\nWhat the teacher says about their teaching:\n"""\n${description}\n"""`;

  const client = new Anthropic({ apiKey: key, timeout: 60_000, maxRetries: 1 });
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      // Thinking tokens count toward max_tokens, so leave generous room even though the JSON itself is small.
      max_tokens: 16000,
      // Writing short copy needs little deliberation. (No temperature: current models reject sampling parameters.)
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error("[kalaa ai] credentials rejected", err.status);
      throw new AiError("The AI service isn't set up correctly. Tell whoever runs this site.");
    }
    if (err instanceof Anthropic.RateLimitError) throw new AiError("The AI service is busy. Try again in a minute.");
    if (err instanceof Anthropic.APIConnectionError) throw new AiError("Couldn't reach the AI service. Try again in a moment.");
    console.error("[kalaa ai] request failed", err instanceof Anthropic.APIError ? err.status : err);
    throw new AiError("The AI couldn't write a draft right now. Try again.");
  }

  if (response.stop_reason === "refusal") throw new AiError("The AI couldn't write this one. Try describing your teaching a little differently.");
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("\n");
  const copy = parseCopy(text);
  if (!copy) throw new AiError("The AI's reply wasn't usable. Try again, or add a bit more detail about your teaching.");
  return copy;
}
