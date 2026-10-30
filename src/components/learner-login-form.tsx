"use client";

import { useActionState, useEffect } from "react";
import { learnerLoginStep, type LearnerLoginState } from "@/app/sites/[site]/auth-actions";
import type { Strings } from "@/lib/i18n";

/** Email, then the 6-digit code. Styled by the storefront theme tokens. */
export function LearnerLoginForm({ next, s }: { next: string; s: Strings }) {
  const [state, action, pending] = useActionState<LearnerLoginState, FormData>(learnerLoginStep, { step: "email" });

  // Full navigation (not router.push), so the storefront host rewrite applies to the destination.
  useEffect(() => {
    if (state.step === "done") window.location.assign(state.next ?? "/my-courses");
  }, [state]);

  if (state.step === "done") return <p className="auth-note" role="status">…</p>;

  if (state.step === "email") {
    return (
      <form action={action} className="auth-form">
        <input type="hidden" name="next" value={next} />
        <label className="auth-field">{s.email}
          <input id="email" name="email" type="email" autoComplete="email" defaultValue={state.email} placeholder="you@example.com" required autoFocus />
        </label>
        {state.error && <p className="auth-err" role="alert">{state.error}</p>}
        <button className="bbtn" type="submit" name="intent" value="send" disabled={pending}>{pending ? s.sendingCode : s.sendCode}</button>
      </form>
    );
  }

  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="email" value={state.email ?? ""} />
      <input type="hidden" name="next" value={next} />
      {state.notice && <p className="auth-note" role="status">{state.notice}</p>}
      <label className="auth-field">{s.codeLabel}
        <input className="otp" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required autoFocus />
      </label>
      {state.error && <p className="auth-err" role="alert">{state.error}</p>}
      <button className="bbtn" type="submit" name="intent" value="check" disabled={pending}>{pending ? s.checking : s.verify}</button>
      <div className="auth-links">
        <button className="bbtn ghost sm" type="submit" name="intent" value="send" formNoValidate disabled={pending}>{s.newCode}</button>
        <button className="bbtn ghost sm" type="submit" name="intent" value="reset" formNoValidate disabled={pending}>{s.otherEmail}</button>
      </div>
    </form>
  );
}
