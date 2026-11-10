import { appSite, bearer, fail, json } from "@/server/app-api";
import { revokeLearnerToken } from "@/server/learner-auth";

export async function POST(req: Request) {
  if (!(await appSite())) return fail(404, "Unknown school.");
  await revokeLearnerToken(bearer(req));
  return json({ ok: true });
}
