"use client";

import { useActionState } from "react";
import type { ReserveState } from "@/app/sites/[site]/actions";
import type { Strings } from "@/lib/i18n";
import { PayPanel, type PayInfo } from "./pay-panel";

const ERRORS: Record<NonNullable<ReserveState["error"]>, string> = {
  name: "Add your name so the creator knows who you are.",
  email: "That email doesn't look right. Check for typos.",
  phone: "Enter a 10-digit WhatsApp number.",
  course: "This course isn't taking reservations right now.",
};

type Props = {
  action: (state: ReserveState, formData: FormData) => Promise<ReserveState>;
  s: Strings;
  price: string;
  /** For a signed-in learner: prefilled, and the email can't be changed (it is what their access is tied to). */
  learner?: { name: string; email: string };
  /** Where to send money, when the teacher has set up UPI. */
  pay?: PayInfo;
};

export function ReserveForm({ action, s, price, learner, pay }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  if (state.reserved) {
    return (
      <div className="ok" role="status">
        <b>{s.reserved}</b>
        <p>{s.reservedSub}</p>
        {pay && <div style={{ marginTop: 14 }}><PayPanel pay={pay} s={s} /></div>}
      </div>
    );
  }

  return (
    <form action={formAction} key={JSON.stringify(state.values ?? {})} style={{ display: "grid", gap: 12 }}>
      <h3>{s.reserve}</h3>
      <p>{s.reserveSub}</p>
      <label>{s.name}<input id="name" name="name" autoComplete="name" defaultValue={state.values?.name ?? learner?.name} required /></label>
      <label>{s.email}<input id="email" name="email" type="email" autoComplete="email" defaultValue={learner?.email ?? state.values?.email} readOnly={!!learner} required /></label>
      <label>{s.phone}<input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98xxxxxxxx" defaultValue={state.values?.phone} required /></label>
      {state.error && <p className="err" role="alert">{ERRORS[state.error]}</p>}
      <button className="bbtn" type="submit" disabled={pending}>{pending ? "…" : `${s.submit} · ${price}`}</button>
    </form>
  );
}
