"use client";

import { useActionState } from "react";
import { loginStep, type LoginState } from "@/app/login/actions";

/** Email, then the 6-digit code. Each button sends an `intent` that picks the step on the server. */
export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginStep, { step: "email" });

  if (state.step === "email") {
    return (
      <form action={action} style={{ display: "grid", gap: 14 }}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" defaultValue={state.email} placeholder="you@example.com" required autoFocus />
        </div>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        <button className="btn gold" type="submit" name="intent" value="send" disabled={pending}>{pending ? "Sending…" : "Email me a code"}</button>
        <p className="hint">New to Kalaa? The same code creates your account.</p>
      </form>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="email" value={state.email ?? ""} />
      <input type="hidden" name="next" value={next} />
      {state.notice && <p className="muted" role="status">{state.notice}</p>}
      <div className="field">
        <label htmlFor="code">Sign-in code</label>
        <input className="input otp" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" required autoFocus />
      </div>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <button className="btn gold" type="submit" name="intent" value="check" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn sm" type="submit" name="intent" value="send" formNoValidate disabled={pending}>Send a new code</button>
        <button className="btn sm" type="submit" name="intent" value="reset" formNoValidate disabled={pending}>Use a different email</button>
      </div>
    </form>
  );
}
