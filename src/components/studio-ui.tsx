"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import type { FormState } from "@/app/studio/actions";

export function StudioNavLink({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path.startsWith(href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

/** A form bound to a server action that returns { error | ok }. */
export function ActionForm({
  action,
  children,
  submit,
  className,
  resetOnOk,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  resetOnOk?: boolean;
}) {
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const next = await action(prev, fd);
    return next ?? {};
  }, {});
  return (
    <form
      action={formAction}
      className={className}
      key={resetOnOk && state.ok ? state.ok : undefined}
      style={{ display: "grid", gap: 14 }}
    >
      {children}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn gold" type="submit" disabled={pending}>{pending ? "Saving…" : submit}</button>
        {state.error && <p className="error" role="alert">{state.error}</p>}
        {state.ok && <p className="hint" role="status" style={{ color: "var(--good)" }}>{state.ok}</p>}
      </div>
    </form>
  );
}

/** The `error` or `ok` message from a server action's return value, if it returned one. */
function messageOf(result: unknown): { error?: string; ok?: string } {
  if (result && typeof result === "object") {
    const r = result as { error?: unknown; ok?: unknown };
    return { error: typeof r.error === "string" ? r.error : undefined, ok: typeof r.ok === "string" ? r.ok : undefined };
  }
  return {};
}

function Message({ msg }: { msg: { error?: string; ok?: string } }) {
  if (msg.error) return <span className="error" role="alert" style={{ fontSize: 12.5 }}>{msg.error}</span>;
  if (msg.ok) return <span className="hint" role="status" style={{ color: "var(--good)" }}>{msg.ok}</span>;
  return null;
}

/** Small button that runs a server action without a form round-trip, and shows what it says back. */
export function ActionButton({
  run,
  children,
  pendingLabel,
  className = "btn sm",
}: {
  run: () => Promise<unknown>;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button className={className} disabled={pending} onClick={() => start(async () => setMsg(messageOf(await run())))}>
        {pending ? pendingLabel ?? "…" : children}
      </button>
      <Message msg={msg} />
    </span>
  );
}

/** Asks once before a destructive action, inline (no browser confirm dialog). */
export function ConfirmButton({ run, label, confirmLabel }: { run: () => Promise<unknown>; label: string; confirmLabel: string }) {
  const [armed, setArmed] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  if (!armed) {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        <button className="btn sm" onClick={() => { setMsg({}); setArmed(true); }}>{label}</button>
        <Message msg={msg} />
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button
        className="btn sm danger"
        disabled={pending}
        onClick={() => start(async () => {
          const m = messageOf(await run());
          setMsg(m);
          if (m.error) setArmed(false);
        })}
      >
        {pending ? "…" : confirmLabel}
      </button>
      <button className="btn sm" onClick={() => setArmed(false)}>Cancel</button>
    </span>
  );
}

export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copy">
      <b>{text}</b>
      <button
        className="btn sm"
        type="button"
        onClick={() =>
          navigator.clipboard?.writeText(text).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => undefined,
          )
        }
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
