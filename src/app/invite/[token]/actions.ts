"use server";

import { redirect } from "next/navigation";
import { currentCreator, endSession } from "@/server/auth";
import { TeamError, acceptInvite } from "@/server/team";

/** Joins the site. Any problem sends the person back to the invitation page, which explains the current state. */
export async function accept(token: string) {
  const creator = await currentCreator();
  if (!creator) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  let slug: string;
  try {
    ({ slug } = await acceptInvite(token, creator.id));
  } catch (err) {
    if (err instanceof TeamError) redirect(`/invite/${encodeURIComponent(token)}`);
    throw err;
  }
  redirect(`/studio/${slug}`);
}

/** For someone signed in as the wrong address. */
export async function switchAccount(token: string) {
  await endSession();
  redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
}
