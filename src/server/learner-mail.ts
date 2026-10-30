import "server-only";
import { escapeHtml as esc, oneLine, sendMail } from "@/server/mail";

/** Tells a learner their payment was confirmed and how to get in. */
export async function sendAccessMail(input: { to: string; name: string; siteName: string; courseTitle: string; origin: string }) {
  const site = oneLine(input.siteName);
  const course = oneLine(input.courseTitle);
  const link = `${input.origin}/my-courses`;
  const hello = oneLine(input.name).split(" ")[0] || "there";
  await sendMail({
    to: input.to,
    subject: `You're in: ${course}`,
    text: `Hi ${hello},\n\nYour payment for “${course}” on ${site} is confirmed.\n\nOpen your courses (sign in with this email address):\n${link}`,
    html: `<p>Hi ${esc(hello)},</p><p>Your payment for <b>${esc(course)}</b> on ${esc(site)} is confirmed.</p><p><a href="${esc(link)}">Open your courses</a> (sign in with this email address)</p>`,
  });
}
