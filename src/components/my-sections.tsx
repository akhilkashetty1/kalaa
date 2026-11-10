"use client";

import { useCallback, useEffect, useState } from "react";
import { ELEMENTS, STARTERS, countElements, customOf, firstText, type CustomProps } from "@/lib/custom";
import type { SavedSection } from "@/lib/types";

// "Build your own" in the Add panel: blank and ready-to-edit starting points, plus the teacher's saved
// sections. Inserting always adds a copy, so changing a section on the page never changes the saved one.

const api = (slug: string, tail = "") => `/api/studio/sections${tail}?site=${encodeURIComponent(slug)}`;

/** `refreshKey` changes whenever a section is saved elsewhere in the editor, so the list reloads even while this panel stays open. */
export function BuildYourOwn({ slug, onAdd, refreshKey }: { slug: string; onAdd: (props: CustomProps) => void; refreshKey: number }) {
  const [saved, setSaved] = useState<SavedSection[] | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(api(slug), { credentials: "same-origin" });
      const body = (await res.json().catch(() => ({}))) as { items?: SavedSection[]; error?: string };
      if (!res.ok || !body.items) return setError(body.error ?? "Couldn't load your saved sections.");
      setSaved(body.items);
    } catch {
      setError("Couldn't load your saved sections.");
    }
  }, [slug]);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const remove = async (id: string) => {
    const res = await fetch(api(slug, `/${id}`), { method: "DELETE", credentials: "same-origin" });
    setConfirm(null);
    if (res.ok) setSaved((l) => (l ? l.filter((x) => x.id !== id) : l));
    else setError("Couldn't delete that section.");
  };

  return (
    <>
      <section className="dsec">
        <h4>Build your own <span>start from a layout</span></h4>
        <div className="lib">
          {STARTERS.map((s) => (
            <button key={s.id} type="button" className="lib-card" onClick={() => onAdd(s.build())}>
              <span className="lib-ico">{s.id === "blank" ? "＋" : "▦"}</span>
              <b>{s.label}</b>
              <small>{s.blurb}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="dsec">
        <h4>My sections <span>{saved ? `${saved.length} saved` : ""}</span></h4>
        {error && <p className="media-err" role="alert">{error}</p>}
        {saved && saved.length === 0 && <p className="hint">Build a custom section, then choose “Save as my section” to keep it here.</p>}
        <ul className="saved">
          {saved?.map((s) => {
            const p = customOf(s.props);
            const kinds = [...new Set(p.cols.flat().map((e) => ELEMENTS[e.type].label))].slice(0, 3).join(", ");
            return (
              <li key={s.id} className="tpl">
                <div><b>{s.name}</b><small>{countElements(p)} elements{kinds ? ` · ${kinds}` : ""}{firstText(p) && !/elements?$/.test(firstText(p)) ? ` · “${firstText(p)}”` : ""}</small></div>
                {confirm === s.id ? (
                  <span className="tpl-ask">
                    <button type="button" className="btn sm danger" onClick={() => remove(s.id)}>Delete</button>
                    <button type="button" className="btn sm" onClick={() => setConfirm(null)}>Keep</button>
                  </span>
                ) : (
                  <span className="tpl-ask">
                    <button type="button" className="btn sm" onClick={() => onAdd(p)}>Insert</button>
                    <button type="button" className="btn sm" aria-label={`Delete ${s.name}`} onClick={() => setConfirm(s.id)}>✕</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
