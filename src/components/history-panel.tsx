"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormState } from "@/app/studio/actions";
import type { SiteSnapshot } from "@/lib/types";

// Version history and scheduled publishes. Every publish is kept (the last 30). Loading a version puts it
// in the editor as an unpublished draft, so nothing changes on the live site until the teacher publishes
// it, and ⌘Z undoes the load. Scheduled publishes wait here until their time, and can be cancelled.

type Version = { id: string; createdAt: string; by: string; label: string };
type Schedule = { id: string; at: string; by: string; status: "pending" | "failed"; error?: string };

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const api = (slug: string, tail = "") => `/api/studio/versions${tail}?site=${encodeURIComponent(slug)}`;

export function HistoryModal({ slug, dirty, onRestore, onCancelSchedule, onClose }: { slug: string; dirty: boolean; onRestore: (s: SiteSnapshot) => void; onCancelSchedule: (id: string) => Promise<FormState>; onClose: () => void }) {
  const [data, setData] = useState<{ versions: Version[]; schedules: Schedule[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(api(slug), { credentials: "same-origin" });
      const body = (await res.json().catch(() => ({}))) as { versions?: Version[]; schedules?: Schedule[]; error?: string };
      if (!res.ok || !body.versions) return setError(body.error ?? "Couldn't load the history.");
      setData({ versions: body.versions, schedules: body.schedules ?? [] });
    } catch {
      setError("Couldn't load the history. Check your connection.");
    }
  }, [slug]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    box.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const restore = async (id: string) => {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(api(slug, `/${id}`), { credentials: "same-origin" });
      const body = (await res.json().catch(() => ({}))) as { snapshot?: SiteSnapshot; error?: string };
      if (!res.ok || !body.snapshot) throw new Error(body.error ?? "Couldn't load that version.");
      onRestore(body.snapshot);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that version.");
      setBusy(null);
      setArmed(null);
    }
  };

  const cancel = async (id: string) => {
    const res = await onCancelSchedule(id);
    if (res.error) setError(res.error);
    await load();
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal hist" role="dialog" aria-modal="true" aria-label="History" ref={box} tabIndex={-1}>
        <div className="modal-h"><b>History</b><button className="btn sm" type="button" onClick={onClose} aria-label="Close">✕</button></div>
        {error && <p className="media-err" role="alert">{error}</p>}
        {!data ? (
          <p className="hint">{error ? "" : "Loading…"}</p>
        ) : (
          <>
            {data.schedules.length > 0 && (
              <section className="dsec">
                <h4>Scheduled <span>goes live by itself</span></h4>
                <ul className="histlist">
                  {data.schedules.map((s) => (
                    <li key={s.id}>
                      <div><b>{when(s.at)}</b><small>{s.status === "failed" ? `Failed: ${s.error ?? "unknown error"}` : `Set by ${s.by}`}</small></div>
                      <button className="btn sm" type="button" onClick={() => cancel(s.id)}>{s.status === "failed" ? "Remove" : "Cancel"}</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="dsec">
              <h4>Published versions <span>the last {data.versions.length || 30}</span></h4>
              {data.versions.length === 0 && <p className="hint">Nothing yet. Each time you publish, that version is kept here, and you can go back to it.</p>}
              <ul className="histlist">
                {data.versions.map((v, i) => (
                  <li key={v.id}>
                    <div><b>{when(v.createdAt)}{i === 0 && <span className="pill ok" style={{ marginLeft: 8 }}>Live now</span>}</b><small>{v.label}{v.by && v.by !== "—" ? ` · ${v.by}` : ""}</small></div>
                    {armed === v.id ? (
                      <span className="tpl-ask">
                        <button className="btn sm gold" type="button" disabled={busy === v.id} onClick={() => restore(v.id)}>{busy === v.id ? "Loading…" : "Load as draft"}</button>
                        <button className="btn sm" type="button" onClick={() => setArmed(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button className="btn sm" type="button" onClick={() => (dirty ? setArmed(v.id) : restore(v.id))}>Restore…</button>
                    )}
                  </li>
                ))}
              </ul>
              {dirty && <p className="hint">You have unpublished changes. Loading a version replaces them in the editor (⌘Z brings them back).</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/** A small control beside Publish: pick a time, and the draft goes live then. */
export function ScheduleControl({ disabled, onSchedule }: { disabled: boolean; onSchedule: (atIso: string) => Promise<FormState> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const openIt = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    setValue((v) => v || local(tomorrow));
    setMsg({});
    setOpen((o) => !o);
  };

  return (
    <div className="pagesw" ref={box}>
      <button type="button" className="btn sm" onClick={openIt} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} title="Publish at a set time">Schedule</button>
      {open && (
        <form
          className="pagemenu sched"
          role="dialog"
          aria-label="Schedule a publish"
          onSubmit={async (e) => {
            e.preventDefault();
            const at = new Date(value);
            if (Number.isNaN(at.getTime())) return setMsg({ error: "Pick a date and time." });
            setBusy(true);
            const res = await onSchedule(at.toISOString());
            setBusy(false);
            setMsg(res);
            if (res.ok) setTimeout(() => setOpen(false), 1200);
          }}
        >
          <b>Publish this draft later</b>
          <label htmlFor="sched-at">Date and time (your computer&apos;s time zone)</label>
          <input id="sched-at" className="input" type="datetime-local" value={value} min={local(new Date(Date.now() + 10 * 60000))} onChange={(e) => setValue(e.target.value)} required />
          <span className="hint">What you see now is what goes live. Later edits aren&apos;t included; schedule again to change it. Checked every few minutes.</span>
          {msg.error && <span className="media-err" role="alert">{msg.error}</span>}
          {msg.ok && <span className="hint" role="status" style={{ color: "var(--good)" }}>Scheduled. See it under History.</span>}
          <button className="btn sm gold" type="submit" disabled={busy}>{busy ? "Scheduling…" : "Schedule publish"}</button>
        </form>
      )}
    </div>
  );
}
