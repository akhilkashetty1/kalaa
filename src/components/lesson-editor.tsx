"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { upload as uploadToBlob } from "@vercel/blob/client";
import { useRef, useState } from "react";
import { MAX_FILES_PER_LESSON, MAX_LESSONS, formatBytes, parseLessons } from "@/lib/lessons";
import type { Lesson, LessonFile } from "@/lib/types";

// Row-by-row lesson editor. Rows are plain state; what the server receives is one hidden field holding
// the rows as JSON. Attachments are uploaded as soon as they are chosen and only their ids are submitted,
// so the server never trusts a file name or type from the browser.

type Row = { uid: string; title: string; minutes: string; free: boolean; url: string; files: LessonFile[]; uploading: number; error: string };

const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.png,.jpg,.jpeg,.webp";
const MAX_MB = 15;

type UploadReply = Partial<LessonFile> & { error?: string };

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; body: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, credentials: "same-origin" });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/**
 * Uploads one attachment. The server first checks the name, size and quota and says where the bytes go:
 * through our own route (local storage) or straight to the private Blob store, after which it checks
 * what arrived and records it.
 */
async function uploadFile(slug: string, file: File): Promise<UploadReply> {
  const q = `?site=${encodeURIComponent(slug)}`;
  const start = await postJson(`/api/studio/upload/start${q}`, { name: file.name, size: file.size });
  if (!start.ok) return { error: String(start.body.error ?? "The upload failed. Try again.") };
  if (start.body.mode === "direct" && typeof start.body.key === "string") {
    await uploadToBlob(start.body.key, file, {
      access: "private",
      handleUploadUrl: `/api/studio/upload/blob${q}`,
      clientPayload: JSON.stringify({ name: file.name, size: file.size }),
      contentType: "application/octet-stream",
      multipart: file.size > 5 * 1024 * 1024,
    });
    const done = await postJson(`/api/studio/upload/complete${q}`, { key: start.body.key, name: file.name });
    return done.ok ? (done.body as UploadReply) : { error: String(done.body.error ?? "The upload failed. Try again.") };
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/studio/upload${q}`, { method: "POST", body: fd, credentials: "same-origin" });
  const body = (await res.json().catch(() => ({}))) as UploadReply;
  return res.ok ? body : { error: body.error ?? "The upload failed. Try again." };
}

const blank = (uid: string): Row => ({ uid, title: "", minutes: "", free: false, url: "", files: [], uploading: 0, error: "" });
const fromLesson = (l: Lesson, uid: string): Row => ({ uid, title: l.title, minutes: String(l.minutes), free: l.free, url: l.url ?? "", files: l.files ?? [], uploading: 0, error: "" });

function RowCard({ row, index, slug, onChange, onRemove, onUpload, onDetach }: { row: Row; index: number; slug: string; onChange: (patch: Partial<Row>) => void; onRemove: () => void; onUpload: (files: FileList) => void; onDetach: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.uid });
  const picker = useRef<HTMLInputElement>(null);
  const n = index + 1;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={`le-row${isDragging ? " dragging" : ""}`}>
      <div className="le-top">
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" className="grip" aria-label={`Drag lesson ${n} to reorder`} title="Drag to reorder">⠿</button>
        <span className="le-n">{n}</span>
        <input className="input le-title" value={row.title} maxLength={120} placeholder="Lesson title" aria-label={`Lesson ${n} title`} onChange={(e) => onChange({ title: e.target.value })} />
        <input className="input le-min" type="number" min={1} max={600} value={row.minutes} placeholder="min" aria-label={`Lesson ${n} minutes`} onChange={(e) => onChange({ minutes: e.target.value })} />
        <label className="le-free" title="Free preview lessons can be watched without paying">
          <button type="button" className="switch" role="switch" aria-checked={row.free} aria-label={`Lesson ${n} free preview`} onClick={() => onChange({ free: !row.free })} />
          <span>Free</span>
        </label>
        <button type="button" className="le-del" aria-label={`Remove lesson ${n}`} onClick={onRemove}>✕</button>
      </div>
      <div className="le-sub">
        <input className="input le-url" value={row.url} placeholder="Video link: YouTube, Vimeo or any https address" aria-label={`Lesson ${n} link`} onChange={(e) => onChange({ url: e.target.value })} />
        <div className="le-files">
          {row.files.map((f) => (
            <span key={f.id} className="le-chip">
              <a href={`/api/studio/files/${f.id}?site=${slug}`} target="_blank" rel="noopener" title="Open to check it">📎 {f.name}</a>
              <small>{formatBytes(f.size)}</small>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onDetach(f.id)}>✕</button>
            </span>
          ))}
          {row.uploading > 0 && <span className="le-chip busy">Uploading {row.uploading}…</span>}
          {row.files.length + row.uploading < MAX_FILES_PER_LESSON && (
            <>
              <button type="button" className="btn sm" onClick={() => picker.current?.click()}>＋ Attach files</button>
              <input ref={picker} type="file" hidden multiple accept={ACCEPT} onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files); e.target.value = ""; }} />
            </>
          )}
        </div>
        {row.error && <p className="error le-err" role="alert">{row.error}</p>}
      </div>
    </li>
  );
}

export function LessonEditor({ slug, initial }: { slug: string; initial: Lesson[] }) {
  const seq = useRef(0);
  const nextUid = () => `n${++seq.current}`;
  const [rows, setRows] = useState<Row[]>(() => (initial.length ? initial.map((l, i) => fromLesson(l, `i${i}`)) : [blank("i0")]));
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const patch = (uid: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...p } : r)));
  const bump = (uid: string, d: number) => setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, uploading: Math.max(0, r.uploading + d) } : r)));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setRows((rs) => arrayMove(rs, rs.findIndex((r) => r.uid === active.id), rs.findIndex((r) => r.uid === over.id)));
  };

  const upload = async (uid: string, list: FileList) => {
    const current = rows.find((r) => r.uid === uid);
    const room = MAX_FILES_PER_LESSON - (current ? current.files.length + current.uploading : 0);
    const chosen = Array.from(list).slice(0, Math.max(0, room));
    patch(uid, { error: list.length > chosen.length ? `A lesson can have at most ${MAX_FILES_PER_LESSON} files.` : "" });
    for (const file of chosen) {
      if (file.size > MAX_MB * 1024 * 1024) { patch(uid, { error: `“${file.name}” is bigger than ${MAX_MB} MB.` }); continue; }
      bump(uid, 1);
      try {
        const body = await uploadFile(slug, file);
        if (!body.id) patch(uid, { error: body.error ?? "The upload failed. Try again." });
        else setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, files: [...r.files, body as LessonFile] } : r)));
      } catch {
        patch(uid, { error: "The upload failed. Check your connection and try again." });
      } finally {
        bump(uid, -1);
      }
    }
  };

  const importList = () => {
    const parsed = parseLessons(paste);
    if ("error" in parsed) return setPasteError(parsed.error);
    if (!parsed.lessons.length) return setPasteError("Type one lesson per line.");
    if (rows.length + parsed.lessons.length > MAX_LESSONS) return setPasteError(`A course can have at most ${MAX_LESSONS} lessons.`);
    // Replace a single untouched blank row rather than leaving an empty lesson at the top.
    const keep = rows.length === 1 && !rows[0].title && !rows[0].url && !rows[0].files.length ? [] : rows;
    setRows([...keep, ...parsed.lessons.map((l) => fromLesson(l, nextUid()))]);
    setPaste("");
    setPasteError("");
  };

  const payload = JSON.stringify(rows.map((r) => ({ title: r.title, minutes: r.minutes, free: r.free, url: r.url, files: r.files.map((f) => f.id) })));
  const busy = rows.some((r) => r.uploading > 0);

  return (
    <div className="le">
      <input type="hidden" name="lessons" value={payload} />
      <div className="le-head">
        <b>{rows.length} {rows.length === 1 ? "lesson" : "lessons"}</b>
        <span className="muted">Drag ⠿ to reorder. “Free” lessons can be watched without paying.</span>
      </div>
      <DndContext id="lessons-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
          <ol className="le-list">
            {rows.map((r, i) => (
              <RowCard key={r.uid} row={r} index={i} slug={slug} onChange={(p) => patch(r.uid, p)} onRemove={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.uid !== r.uid) : [blank(nextUid())]))} onUpload={(files) => void upload(r.uid, files)} onDetach={(id) => patch(r.uid, { files: r.files.filter((f) => f.id !== id) })} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="le-actions">
        <button type="button" className="btn sm" disabled={rows.length >= MAX_LESSONS} onClick={() => setRows((rs) => [...rs, blank(nextUid())])}>＋ Add a lesson</button>
        {busy && <span className="hint">Wait for uploads to finish before saving.</span>}
      </div>
      <details className="le-paste">
        <summary>Paste a list of lessons</summary>
        <textarea className="input prose" rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"One lesson per line. Minutes, free and a link are optional:\nWhy vectors? | 12 | free | https://youtu.be/…\nMotion in 1D | 18"} />
        {pasteError && <p className="error" role="alert">{pasteError}</p>}
        <button type="button" className="btn sm" onClick={importList}>Add these lessons</button>
      </details>
      <p className="hint">Files attached here are private to your students. Free-preview lessons&apos; files can be opened by anyone. Videos stay on YouTube or Vimeo; use unlisted ones. Max {MAX_MB} MB per file: PDF, Word, PowerPoint, Excel, text, CSV, images or ZIP.</p>
    </div>
  );
}
