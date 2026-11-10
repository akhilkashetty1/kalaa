"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MEDIA_ACCEPT, MAX_ALT, formatSize, mediaIdOf, mediaUrl } from "@/lib/media";
import type { MediaItem } from "@/lib/types";
import { useMediaSite } from "./media-context";
import { uploadViaApi } from "./upload-client";

// The site's image library: upload, browse, describe and delete. Used two ways: as a panel in the editor
// (manage mode), and inside the picker that image fields open (pick mode, where a click chooses an image).
// ImageField is the control that image fields use everywhere: a preview, "Choose from library", and a
// fallback for pasting a link.

type Library = { items: MediaItem[]; used: number; quota: number };

const api = (slug: string, tail = "") => `/api/studio/media${tail}?site=${encodeURIComponent(slug)}`;

export function MediaLibrary({ slug, onPick, selected }: { slug: string; onPick?: (item: MediaItem) => void; selected?: string }) {
  const [lib, setLib] = useState<Library | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(api(slug), { credentials: "same-origin" });
      const body = (await res.json().catch(() => ({}))) as Partial<Library> & { error?: string };
      if (!res.ok || !body.items) return setError(body.error ?? "Couldn't load your images.");
      setLib(body as Library);
    } catch {
      setError("Couldn't load your images. Check your connection.");
    }
  }, [slug]);
  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (files: FileList | File[]) => {
    setError("");
    for (const file of Array.from(files).slice(0, 12)) {
      setBusy((n) => n + 1);
      const res = await uploadViaApi<MediaItem>("/api/studio/media", slug, file);
      setBusy((n) => n - 1);
      if (!res.item) {
        setError(`${file.name}: ${res.error}`);
        continue;
      }
      const item = res.item;
      setLib((l) => (l ? { ...l, items: [item, ...l.items], used: l.used + item.size } : l));
      if (onPick && files.length === 1) onPick(item); // in the picker, a single upload is chosen straight away
    }
  };

  const current = lib?.items.find((m) => m.id === open) ?? null;

  return (
    <div
      className="media"
      data-over={over}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
    >
      <div className="media-bar">
        <button className="btn sm gold" type="button" onClick={() => input.current?.click()} disabled={busy > 0}>{busy > 0 ? `Uploading ${busy}…` : "Upload images"}</button>
        <input ref={input} type="file" hidden multiple accept={MEDIA_ACCEPT} onChange={(e) => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ""; }} />
        {lib && <span className="hint">{formatSize(lib.used)} of {formatSize(lib.quota)} used</span>}
      </div>
      {error && <p className="media-err" role="alert">{error}</p>}

      {!lib ? (
        <p className="hint">{error ? "" : "Loading…"}</p>
      ) : lib.items.length === 0 ? (
        <div className="media-empty">
          <b>Your library is empty</b>
          <p>Drop your logo, photos and graphics here, or press Upload. PNG, JPG, WebP, GIF or SVG, up to 8 MB. Anything you upload is public, because it appears on your website.</p>
        </div>
      ) : (
        <ul className="media-grid">
          {lib.items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="media-tile"
                aria-pressed={onPick ? selected === mediaUrl(m.id) : open === m.id}
                onClick={() => (onPick ? onPick(m) : setOpen(open === m.id ? null : m.id))}
                title={m.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(m.id)} alt={m.alt || m.name} loading="lazy" />
                <span>{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!onPick && current && (
        <MediaDetails
          key={current.id}
          slug={slug}
          item={current}
          onClose={() => setOpen(null)}
          onChanged={(patch) => setLib((l) => (l ? { ...l, items: l.items.map((m) => (m.id === current.id ? { ...m, ...patch } : m)) } : l))}
          onDeleted={() => {
            setLib((l) => (l ? { ...l, items: l.items.filter((m) => m.id !== current.id), used: l.used - current.size } : l));
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function MediaDetails({ slug, item, onClose, onChanged, onDeleted }: { slug: string; item: MediaItem; onClose: () => void; onChanged: (p: Partial<MediaItem>) => void; onDeleted: () => void }) {
  const [alt, setAlt] = useState(item.alt);
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);

  const saveAlt = async () => {
    if (alt.trim() === item.alt) return;
    const res = await fetch(api(slug, `/${item.id}`), { method: "PATCH", body: JSON.stringify({ alt }), headers: { "Content-Type": "application/json" }, credentials: "same-origin" });
    if (res.ok) {
      onChanged({ alt: alt.trim() });
      setMsg("Saved");
    } else setMsg("Couldn't save the description.");
  };
  const remove = async () => {
    const res = await fetch(api(slug, `/${item.id}`), { method: "DELETE", credentials: "same-origin" });
    if (res.ok) return onDeleted();
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setConfirm(false);
    setMsg(body.error ?? "Couldn't delete that image.");
  };

  return (
    <div className="media-detail">
      <div className="media-detail-h">
        <b title={item.name}>{item.name}</b>
        <button className="btn sm" type="button" onClick={onClose} aria-label="Close details">✕</button>
      </div>
      <div className="media-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaUrl(item.id)} alt={item.alt || item.name} />
      </div>
      <p className="hint">{item.width && item.height ? `${item.width} × ${item.height} · ` : ""}{formatSize(item.size)}</p>
      <div className="field">
        <label htmlFor={`alt-${item.id}`}>Description</label>
        <input id={`alt-${item.id}`} className="input" value={alt} maxLength={MAX_ALT} placeholder="What the picture shows" onChange={(e) => { setAlt(e.target.value); setMsg(""); }} onBlur={saveAlt} />
        <span className="hint">Read aloud by screen readers and shown if the image can&apos;t load.</span>
      </div>
      <div className="insp-actions">
        {confirm ? (
          <>
            <button className="btn sm danger" type="button" onClick={remove}>Yes, delete</button>
            <button className="btn sm" type="button" onClick={() => setConfirm(false)}>Keep</button>
          </>
        ) : (
          <button className="btn sm danger" type="button" onClick={() => { setConfirm(true); setMsg(""); }}>Delete</button>
        )}
      </div>
      {msg && <p className="hint" role="status">{msg}</p>}
    </div>
  );
}

/** A modal that shows the library and returns the chosen image's address. */
export function MediaPicker({ slug, selected, onPick, onClose }: { slug: string; selected?: string; onPick: (url: string) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal media-modal" role="dialog" aria-modal="true" aria-label="Choose an image">
        <div className="modal-h">
          <b>Choose an image</b>
          <button className="btn sm" type="button" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <MediaLibrary slug={slug} selected={selected} onPick={(m) => onPick(mediaUrl(m.id))} />
      </div>
    </div>
  );
}

/**
 * The control for any image field: preview, choose from the library, remove, or paste a link instead.
 * Without a media context (outside the editor) it falls back to a plain link input.
 */
export function ImageField({ id, value, onChange, hint }: { id: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const site = useMediaSite();
  const [picking, setPicking] = useState(false);
  const fromLibrary = mediaIdOf(value) !== null;

  if (!site) return <input className="input" id={id} value={value} placeholder="https://…/photo.jpg" onChange={(e) => onChange(e.target.value)} />;
  return (
    <div className="imgf">
      <div className="imgf-row">
        <div className="imgf-thumb" data-empty={!value}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" referrerPolicy="no-referrer" /> : <span>No image</span>}
        </div>
        <div className="imgf-actions">
          <button className="btn sm" type="button" id={id} onClick={() => setPicking(true)}>{value ? "Replace" : "Choose image"}</button>
          {value && <button className="btn sm" type="button" onClick={() => onChange("")}>Remove</button>}
        </div>
      </div>
      {hint && <span className="hint">{hint}</span>}
      <details className="imgf-link" open={!!value && !fromLibrary}>
        <summary>Use a link instead</summary>
        <input className="input" aria-label="Image link" value={fromLibrary ? "" : value} placeholder="https://…/photo.jpg" onChange={(e) => onChange(e.target.value)} />
      </details>
      {picking && <MediaPicker slug={site.slug} selected={value} onPick={(url) => { onChange(url); setPicking(false); }} onClose={() => setPicking(false)} />}
    </div>
  );
}
