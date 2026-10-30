"use client";

import { useState } from "react";
import type { Strings } from "@/lib/i18n";

export type PayInfo = { upiId: string; note?: string; payee: string; amount: number; course: string };

/** How to pay: a button that opens the student's UPI app with everything filled in, and the UPI ID to copy. */
export function PayPanel({ pay, s }: { pay: PayInfo; s: Strings }) {
  const [copied, setCopied] = useState(false);
  const link = `upi://pay?pa=${encodeURIComponent(pay.upiId)}&pn=${encodeURIComponent(pay.payee.slice(0, 40))}&am=${pay.amount}&cu=INR&tn=${encodeURIComponent(pay.course.slice(0, 40))}`;
  return (
    <div className="pay">
      <b>{s.payTitle}</b>
      <a className="bbtn" href={link}>{s.payBtn} · ₹{pay.amount.toLocaleString("en-IN")}</a>
      <div className="pay-id">
        <code>{pay.upiId}</code>
        <button
          type="button"
          className="bbtn ghost sm"
          onClick={() => navigator.clipboard?.writeText(pay.upiId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => undefined)}
        >
          {copied ? s.payCopied : s.payCopy}
        </button>
      </div>
      <small>{s.payOnPhone}</small>
      {pay.note && <p className="pay-note">{pay.note}</p>}
      <small>{s.payAfter}</small>
    </div>
  );
}
