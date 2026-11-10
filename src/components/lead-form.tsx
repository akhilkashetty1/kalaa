"use client";

import { useRef, useState, type FormEvent } from "react";
import { submitLead } from "@/app/sites/[site]/lead-actions";
import { formConfig, type El } from "@/lib/custom";
import type { Block } from "@/lib/types";
import { Editable } from "./editable";
import { useSite } from "./site-context";

// A storefront form. Visitors fill it in; the server checks it against the form's published settings and
// stores it as a lead. A hidden field and the time spent filling it in turn away bots. In the editor the
// fields are shown but do nothing, and the button text can be edited in place.

export function LeadForm({ b, el, labelPath }: { b: Block; el: El; labelPath: string }) {
  const { editor } = useSite();
  const cfg = formConfig(el);
  const [vals, setVals] = useState({ name: "", email: "", phone: "", message: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState("");
  const opened = useRef(Date.now());
  const id = `f-${el.id}`;
  const set = (k: keyof typeof vals) => (e: { target: { value: string } }) => setVals((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (editor || state === "sending") return;
    setState("sending");
    setError("");
    const res = await submitLead({ formId: el.id, values: { ...vals, answers }, consent, hp, elapsed: Date.now() - opened.current, path: location.pathname });
    if (res.ok) {
      setThanks(res.message);
      setState("done");
    } else {
      setError(res.error);
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="cs-form cs-form-done" role="status">
        <b>{thanks}</b>
      </div>
    );
  }

  const off = !!editor;
  return (
    <form className="cs-form" onSubmit={submit} noValidate={false} aria-label={cfg.title}>
      <label htmlFor={`${id}-name`}>Name<input id={`${id}-name`} className="cs-in" name="name" autoComplete="name" required maxLength={80} value={vals.name} onChange={set("name")} disabled={off} /></label>
      <label htmlFor={`${id}-email`}>Email<input id={`${id}-email`} className="cs-in" name="email" type="email" autoComplete="email" required maxLength={254} value={vals.email} onChange={set("email")} disabled={off} /></label>
      {cfg.phone && <label htmlFor={`${id}-phone`}>Phone{cfg.phoneRequired ? "" : " (optional)"}<input id={`${id}-phone`} className="cs-in" name="phone" type="tel" autoComplete="tel" inputMode="tel" required={cfg.phoneRequired} maxLength={30} value={vals.phone} onChange={set("phone")} disabled={off} /></label>}
      {cfg.questions.map((q, i) => (
        <label key={i} htmlFor={`${id}-q${i}`}>{q.label}{q.required ? "" : " (optional)"}<input id={`${id}-q${i}`} className="cs-in" required={q.required} maxLength={300} value={answers[String(i)] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [String(i)]: e.target.value }))} disabled={off} /></label>
      ))}
      {cfg.message && <label htmlFor={`${id}-msg`}>Message (optional)<textarea id={`${id}-msg`} className="cs-in" name="message" rows={3} maxLength={1000} value={vals.message} onChange={set("message")} disabled={off} /></label>}
      {cfg.consent && (
        <label className="cs-consent" htmlFor={`${id}-consent`}>
          <input id={`${id}-consent`} type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={off} />
          <span>{cfg.consent}</span>
        </label>
      )}
      {/* Honeypot: invisible to people, tempting to bots. */}
      <div className="cs-hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label></div>
      {error && <p className="cs-form-err" role="alert">{error}</p>}
      {off ? (
        <span className="bbtn"><Editable blockId={b.id} path={labelPath} value={cfg.button} as="span" max={30} placeholder="Button" /></span>
      ) : (
        <button className="bbtn" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : cfg.button}</button>
      )}
    </form>
  );
}
