import "server-only";
// Sends transactional email. With RESEND_API_KEY and MAIL_FROM set, mail goes through Resend;
// otherwise, outside production, it is printed to the server log so local sign-in still works.

// Names come from users, so they are stripped of line breaks (subject lines) and escaped (HTML bodies).
export const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Where replies go, e.g. the teacher who wrote an announcement. */
  replyTo?: string;
  /** Shown as "<name> via Kalaa" in the From line. The sending address stays Kalaa's own. */
  fromName?: string;
};

/** "Priya Nair via Kalaa <address>", keeping only the address from MAIL_FROM. The name is cleaned so it can't break the header. */
function senderLine(configured: string, name?: string) {
  const clean = (name ?? "").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 60);
  if (!clean) return configured;
  const address = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim();
  return `${clean} via Kalaa <${address}>`;
}

export async function sendMail(mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (key && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: senderLine(from, mail.fromName), to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}) }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Email provider returned ${res.status}`);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Email is not configured. Set RESEND_API_KEY and MAIL_FROM.");
  }
  console.info(`\n[kalaa mail] to ${mail.to}${mail.replyTo ? ` (replies to ${mail.replyTo})` : ""}\n  ${mail.subject}\n  ${mail.text.replace(/\n/g, "\n  ")}\n`);
}
