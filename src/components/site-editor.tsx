"use client";

import { DndContext, KeyboardSensor, MeasuringStrategy, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { FormState } from "@/app/studio/actions";
import { BLOCKS, newBlock, newBlockId, setPath } from "@/lib/blocks";
import { TEMPLATES, starterBlocks, type TemplateId } from "@/lib/templates";
import { LOOKS, themeVars } from "@/lib/theme";
import type { Theme } from "@/lib/theme";
import type { Block, PublicCourse, Site, SiteDraft, SiteChrome, SitePage } from "@/lib/types";
import { applyCopy, type AiCopy } from "@/lib/ai-copy";
import { COURSE, HOME, blocksOf, copyPage, newPage, withBlocks } from "@/lib/pages";
import { PageBlocks } from "./blocks";
import { AddPanel, BlockInspector, DesignPanel, Seg } from "./editor-panels";
import { SiteProvider, type EditorApi, type SiteFacts } from "./site-context";
import { CustomInspector } from "./custom-inspector";
import { HistoryModal, ScheduleControl } from "./history-panel";
import { MediaCtx } from "./media-context";
import { PageSettings, PageSwitcher } from "./page-panel";
import { MediaLibrary } from "./media-library";
import { SitePopup } from "./site-popup";
import { SiteSettings } from "./site-settings";
import { customOf, firstText, removeEl, type CustomProps } from "@/lib/custom";
import { SiteFooter, SiteNav, ThemeScope } from "./storefront";

// The full-screen site editor: a live canvas rendering the real storefront components, a layers list,
// a block library, and an inspector. Everything the creator does goes through `commit`, which keeps an
// undo history, so every change (including a whole template) can be taken back.

type Doc = SiteDraft;
type Device = "desktop" | "tablet" | "mobile";

type Ed = {
  selectedId: string | null;
  preview: boolean;
  select: (id: string | null) => void;
  move: (id: string, dir: -1 | 1) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  toggleHidden: (id: string) => void;
  insertAt: (index: number) => void;
};
const EdCtx = createContext<Ed | null>(null);

/** The editor's wrapper around each block on the canvas: selection, toolbar, drag handle, insert button. */
function Frame({ block, index, className, anchor, children }: { block: Block; index: number; className: string; anchor?: string; children: ReactNode }) {
  const ed = useContext(EdCtx)!;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const label = BLOCKS[block.type].label;
  const selected = ed.selectedId === block.id;
  return (
    <section
      ref={setNodeRef}
      id={anchor}
      data-bid={block.id}
      data-tone={block.tone ?? "base"}
      data-label={label}
      className={`${className} ed-frame${selected && !ed.preview ? " sel" : ""}${isDragging ? " dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onPointerDownCapture={() => !ed.preview && ed.select(block.id)}
    >
      {!ed.preview && (
        <>
          <button type="button" className="ed-plus" onClick={() => ed.insertAt(index)} aria-label={`Add a section above ${label}`}><span>+</span> Add section</button>
          <div className="ed-tools" role="toolbar" aria-label={`${label} section`}>
            <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" className="grip" aria-label={`Drag the ${label} section to reorder`} title="Drag to reorder">⠿</button>
            <span className="tl">{label}</span>
            <button type="button" aria-label="Move up" onClick={() => ed.move(block.id, -1)}>↑</button>
            <button type="button" aria-label="Move down" onClick={() => ed.move(block.id, 1)}>↓</button>
            {block.type !== "coursecore" && (
              <>
                <button type="button" aria-label="Duplicate" onClick={() => ed.duplicate(block.id)}>⧉</button>
                <button type="button" aria-label={block.hidden ? "Show" : "Hide"} onClick={() => ed.toggleHidden(block.id)}>{block.hidden ? "◌" : "◉"}</button>
                <button type="button" aria-label="Delete" className="del" onClick={() => ed.remove(block.id)}>✕</button>
              </>
            )}
          </div>
          <div className="ed-collapsed" aria-hidden="true"><span>{BLOCKS[block.type].icon}</span>{label}</div>
        </>
      )}
      {children}
    </section>
  );
}

const gist = (b: Block) => b.type === "custom" ? firstText(customOf(b.props)) : String(b.props.headline ?? b.props.title ?? b.props.text ?? b.props.eyebrow ?? "").replace(/\*/g, "").slice(0, 40);

function LayerRow({ block, selected, onSelect }: { block: Block; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={`layer${selected ? " sel" : ""}${isDragging ? " dragging" : ""}${block.hidden ? " off" : ""}`}>
      <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" className="grip" aria-label={`Drag ${BLOCKS[block.type].label} to reorder`}>⠿</button>
      <button type="button" className="layer-main" onClick={onSelect}>
        <span className="lib-ico">{BLOCKS[block.type].icon}</span>
        <span><b>{BLOCKS[block.type].label}</b><small>{gist(block) || "—"}</small></span>
      </button>
    </li>
  );
}

type Props = {
  slug: string;
  site: Site;
  courses: PublicCourse[];
  facts: SiteFacts;
  host: string;
  liveUrl: string;
  initialBlocks: Block[];
  initialChrome: SiteChrome;
  initialPages: SitePage[];
  initialCourseTemplate: Block[];
  publish: (draft: SiteDraft) => Promise<FormState>;
  schedule: (draft: SiteDraft, at: string) => Promise<FormState>;
  cancelSchedule: (id: string) => Promise<FormState>;
  /** Whether the server can write AI drafts (an API key is set). */
  aiEnabled: boolean;
};

export function SiteEditor({ slug, site, courses, facts, host, liveUrl, initialBlocks, initialChrome, initialPages, initialCourseTemplate, publish, schedule, cancelSchedule, aiEnabled }: Props) {
  const initial: Doc = useMemo(() => ({ name: site.name, theme: site.theme, blocks: initialBlocks, chrome: initialChrome, pages: initialPages, courseTemplate: initialCourseTemplate }), [site, initialBlocks, initialChrome, initialPages, initialCourseTemplate]);
  const [doc, setDocState] = useState<Doc>(initial);
  const docRef = useRef(doc);
  const savedRef = useRef(JSON.stringify(initial));
  const [saved, setSaved] = useState(savedRef.current);
  const hist = useRef({ past: [] as Doc[], future: [] as Doc[], key: "", at: 0 });
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selEl, setSelEl] = useState<{ blockId: string; elId: string } | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const [popupPreview, setPopupPreview] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [preview, setPreview] = useState(false);
  const [left, setLeft] = useState<"layers" | "add" | "media">("layers");
  const [right, setRight] = useState<"block" | "design" | "site" | "page">("block");
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "ok" | "err" } | null>(null);
  const [restored, setRestored] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Which page is being edited: "home", an extra page's id, or "course" (the template shared by every course page).
  // A ref mirrors it so the block operations below always act on the page on screen.
  const [pageId, setPageIdState] = useState<string>(HOME);
  const pageIdRef = useRef<string>(HOME);
  const blocksIn = (d: Doc) => blocksOf(d, pageIdRef.current);
  const setPage = (id: string) => {
    pageIdRef.current = id;
    setPageIdState(id);
    setSelectedId(null);
    setSelEl(null);
    setInsertIndex(null);
    setRight("block");
  };

  const setDoc = (d: Doc) => {
    docRef.current = d;
    setDocState(d);
  };

  /** Applies a change and records it for undo. Changes with the same `key` in quick succession (typing) merge into one step. */
  const commit = useCallback((change: (d: Doc) => Doc, key?: string) => {
    const cur = docRef.current;
    const next = change(cur);
    if (next === cur) return;
    const h = hist.current;
    const now = Date.now();
    if (!(key && key === h.key && now - h.at < 900)) {
      h.past.push(cur);
      if (h.past.length > 100) h.past.shift();
    }
    h.future = [];
    h.key = key ?? "";
    h.at = now;
    setDoc(next);
    bump();
  }, []);

  const undo = useCallback(() => {
    const h = hist.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(docRef.current);
    h.key = "";
    setDoc(prev);
    bump();
  }, []);
  const redo = useCallback(() => {
    const h = hist.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(docRef.current);
    h.key = "";
    setDoc(next);
    bump();
  }, []);

  const dirty = JSON.stringify(doc) !== saved;

  // Draft recovery: unpublished work survives a refresh or a closed tab.
  const draftKey = `kalaa-draft:${site.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as { base: string; doc: Doc };
      if (d.base === savedRef.current && JSON.stringify(d.doc) !== savedRef.current) {
        setDoc(d.doc);
        setRestored(true);
      } else localStorage.removeItem(draftKey);
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (JSON.stringify(doc) === saved) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ base: saved, doc }));
      } catch {}
    }, 500);
    return () => clearTimeout(id);
  }, [doc, saved, draftKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const flash = (text: string, tone: "ok" | "err" = "ok") => {
    setNote({ text, tone });
    setTimeout(() => setNote((n) => (n?.text === text ? null : n)), 3200);
  };

  // ---- block operations ----
  const idx = (id: string) => blocksIn(docRef.current).findIndex((b) => b.id === id);
  const mapBlocks = (fn: (b: Block[]) => Block[], key?: string) => commit((d) => withBlocks(d, pageIdRef.current, fn(blocksOf(d, pageIdRef.current))), key);

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    setSelEl((s) => (s && s.blockId === id ? s : null)); // selecting another section drops the element selection
    if (id) setRight((r) => (r === "block" ? r : "block"));
  }, []);
  const selectEl = useCallback((blockId: string, elId: string) => {
    setSelectedId(blockId);
    setSelEl({ blockId, elId });
    setRight("block");
  }, []);
  const scrollTo = (id: string) => requestAnimationFrame(() => scroller.current?.querySelector(`[data-bid="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const ed: Ed = useMemo(
    () => ({
      selectedId,
      preview,
      select,
      move: (id, dir) => {
        const i = idx(id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= blocksIn(docRef.current).length) return;
        mapBlocks((b) => arrayMove(b, i, j));
        scrollTo(id);
      },
      duplicate: (id) => {
        const i = idx(id);
        if (i < 0) return;
        if (blocksIn(docRef.current)[i].type === "coursecore") return flash("The course details are shown once on every course page.", "err");
        const copy: Block = { ...JSON.parse(JSON.stringify(blocksIn(docRef.current)[i])), id: newBlockId() };
        mapBlocks((b) => [...b.slice(0, i + 1), copy, ...b.slice(i + 1)]);
        setSelectedId(copy.id);
        scrollTo(copy.id);
      },
      remove: (id) => {
        const target = blocksIn(docRef.current).find((b) => b.id === id);
        if (target?.type === "coursecore") return flash("The course details can't be removed. Add your own sections above or below them.", "err");
        if (blocksIn(docRef.current).length <= 1) return flash("A page needs at least one section.", "err");
        mapBlocks((b) => b.filter((x) => x.id !== id));
        setSelectedId((s) => (s === id ? null : s));
        flash("Section deleted. ⌘Z brings it back.");
      },
      toggleHidden: (id) => mapBlocks((b) => b.map((x) => (x.id === id ? { ...x, hidden: !x.hidden } : x))),
      insertAt: (index) => {
        setInsertIndex(index);
        setLeft("add");
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, preview, select],
  );

  const addBlock = (type: string) => {
    const at = insertIndex ?? (selectedId ? idx(selectedId) + 1 : blocksIn(docRef.current).length);
    const b = newBlock(type);
    mapBlocks((list) => [...list.slice(0, at), b, ...list.slice(at)]);
    setInsertIndex(null);
    setSelectedId(b.id);
    setRight("block");
    scrollTo(b.id);
  };

  const applyTemplate = (id: TemplateId, withLook = false) => {
    if (pageIdRef.current !== HOME) return; // templates describe a home page
    // Keep the creator's own headline and intro; the template supplies structure and the rest of the copy.
    const blocks = starterBlocks(id, { name: doc.name, headline: site.headline, bio: site.bio, creator: site.creator, stats: site.stats, live: site.live, quotes: site.quotes, community: site.community }, { useSiteCopy: true });
    const look = LOOKS[TEMPLATES.find((t) => t.id === id)!.look].theme;
    commit((d) => ({ ...d, blocks, theme: withLook ? { ...d.theme, ...look, custom: undefined } : d.theme }));
    setSelectedId(null);
    flash("Template applied. ⌘Z undoes it.");
  };

  const setProp = useCallback((blockId: string, path: string, value: unknown) => {
    commit((d) => withBlocks(d, pageIdRef.current, blocksOf(d, pageIdRef.current).map((b) => (b.id === blockId ? { ...b, props: setPath(b.props, path, value) } : b))), `${blockId}:${path}`);
  }, [commit]);

  // ---- pages ----
  const slugsExcept = (id?: string) => new Set(docRef.current.pages.filter((p) => p.id !== id).map((p) => p.slug));
  const addPage = (title: string) => {
    const pg = newPage(title, slugsExcept());
    commit((d) => ({ ...d, pages: [...d.pages, pg] }));
    setPage(pg.id);
    flash(`“${pg.title}” added. It goes live when you publish.`);
  };
  const updatePage = (id: string, patch: Partial<Pick<SitePage, "title" | "slug" | "description" | "inMenu">>, key?: string) =>
    commit((d) => ({ ...d, pages: d.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), key ? `page:${id}:${key}` : undefined);
  const movePage = (id: string, dir: -1 | 1) =>
    commit((d) => {
      const i = d.pages.findIndex((p) => p.id === id);
      const j = i + dir;
      return i < 0 || j < 0 || j >= d.pages.length ? d : { ...d, pages: arrayMove(d.pages, i, j) };
    });
  const duplicatePage = (id: string) => {
    const src = docRef.current.pages.find((p) => p.id === id);
    if (!src) return;
    const pg = copyPage(src, slugsExcept());
    commit((d) => {
      const i = d.pages.findIndex((p) => p.id === id);
      return { ...d, pages: [...d.pages.slice(0, i + 1), pg, ...d.pages.slice(i + 1)] };
    });
    setPage(pg.id);
  };
  const deletePage = (id: string) => {
    commit((d) => ({ ...d, pages: d.pages.filter((p) => p.id !== id) }));
    setPage(HOME);
    flash("Page deleted. ⌘Z brings it back.");
  };

  /** Asks the server for a first draft of the words, and writes it into the home page's sections as an unpublished draft. */
  const writeWithAi = async (description: string, language: "en" | "hi"): Promise<string | null> => {
    try {
      const res = await fetch(`/api/studio/ai/copy?site=${encodeURIComponent(slug)}`, { method: "POST", body: JSON.stringify({ description, language }), headers: { "Content-Type": "application/json" }, credentials: "same-origin" });
      const body = (await res.json().catch(() => ({}))) as { copy?: AiCopy; error?: string };
      if (!res.ok || !body.copy) return body.error ?? "Couldn't write a draft. Try again.";
      const copy = body.copy;
      commit((d) => ({ ...d, blocks: applyCopy(d.blocks, copy), theme: language === "hi" ? { ...d.theme, lang: "hi" } : d.theme }));
      flash("Draft written into your page. Read it, edit it, then publish. ⌘Z undoes it.");
      return null;
    } catch {
      return "Couldn't reach the server. Check your connection.";
    }
  };

  /** Puts a kept version in the editor as an unpublished draft. Nothing goes live until Publish, and ⌘Z undoes it. */
  const restoreSnapshot = (snap: SiteDraft) => {
    commit(() => ({ name: snap.name, theme: snap.theme, blocks: snap.blocks, chrome: snap.chrome, pages: snap.pages ?? [], courseTemplate: snap.courseTemplate ?? initialCourseTemplate }));
    setPage(HOME);
    flash("Version loaded as a draft. Review it, then publish. ⌘Z undoes it.");
  };

  const setChrome = (next: (c: SiteChrome) => SiteChrome, key?: string) => commit((d) => ({ ...d, chrome: next(d.chrome) }), key ? `chrome:${key}` : undefined);

  /** Applies a pure change to one custom section. Typing and sliders pass a key so quick changes undo as one step. */
  const updateCustom = (blockId: string, fn: (p: CustomProps) => CustomProps, key?: string) =>
    commit((d) => withBlocks(d, pageIdRef.current, blocksOf(d, pageIdRef.current).map((b) => (b.id === blockId && b.type === "custom" ? { ...b, props: fn(customOf(b.props)) as unknown as Record<string, unknown> } : b))), key ? `${blockId}:${key}` : undefined);

  const addCustom = (props: CustomProps) => {
    const at = insertIndex ?? (selectedId ? idx(selectedId) + 1 : blocksIn(docRef.current).length);
    const b = newBlock("custom", props as unknown as Record<string, unknown>);
    mapBlocks((list) => [...list.slice(0, at), b, ...list.slice(at)]);
    setInsertIndex(null);
    setSelectedId(b.id);
    setSelEl(null);
    setRight("block");
    scrollTo(b.id);
  };

  const saveMySection = async (block: Block, name: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/studio/sections?site=${encodeURIComponent(slug)}`, { method: "POST", body: JSON.stringify({ name, props: customOf(block.props) }), headers: { "Content-Type": "application/json" }, credentials: "same-origin" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return body.error ?? "Couldn't save the section.";
      setSavedTick((n) => n + 1);
      flash("Saved. Find it under Add → My sections.");
      return null;
    } catch {
      return "Couldn't save the section. Check your connection.";
    }
  };

  const setTheme = (patch: Partial<Theme>, key?: string) => commit((d) => ({ ...d, theme: { ...d.theme, ...patch } }), key ? `theme:${key}` : undefined);

  // ---- drag and drop (canvas and layers) ----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const curBlocks = blocksOf(doc, pageId);
  const curPage = doc.pages.find((p) => p.id === pageId) ?? null;
  const ids = curBlocks.map((b) => b.id);
  const onDragEnd = (e: DragEndEvent) => {
    setReordering(false);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    mapBlocks((b) => arrayMove(b, from, to));
    scrollTo(String(active.id));
  };

  // If the page on screen disappears (undo of "add page", for instance), fall back to Home.
  useEffect(() => {
    if (pageId !== HOME && pageId !== COURSE && !doc.pages.some((p) => p.id === pageId)) setPage(HOME);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.pages, pageId]);

  // ---- shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        redo();
      } else if (!typing && selEl && !preview && (e.key === "Backspace" || e.key === "Delete" || e.key === "Escape")) {
        // With an element selected these keys act on the element, never on the whole section.
        e.preventDefault();
        if (e.key === "Escape") setSelEl(null);
        else {
          updateCustom(selEl.blockId, (p) => removeEl(p, selEl.elId));
          setSelEl(null);
          flash("Element deleted. ⌘Z brings it back.");
        }
      } else if (!typing && selectedId && !preview) {
        if (mod && e.key.toLowerCase() === "d") {
          e.preventDefault();
          ed.duplicate(selectedId);
        } else if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          ed.remove(selectedId);
        } else if (e.key === "Escape") setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, selEl, preview, ed, undo, redo]);

  const publishNow = async () => {
    setBusy(true);
    const snapshot = JSON.stringify(docRef.current);
    const res = await publish(docRef.current);
    setBusy(false);
    if (res.error) return flash(res.error, "err");
    setSaved(snapshot);
    flash("Published. Your site is live.");
  };

  const selected = curBlocks.find((b) => b.id === selectedId) ?? null;
  const where = insertIndex != null ? (insertIndex >= curBlocks.length ? "Adding at the end of the page." : `Adding above “${BLOCKS[curBlocks[insertIndex].type].label}”.`) : selected ? `Adding below “${BLOCKS[selected.type].label}”.` : "Adding at the end of the page.";

  const editor: EditorApi = useMemo(() => ({ selectedId, selectedElId: selEl?.elId ?? null, select, selectEl, setProp, Frame }), [selectedId, selEl, select, selectEl, setProp]);
  const navSite: Site = { ...site, name: doc.name, theme: doc.theme };
  const pub = { name: doc.name, slug, creator: site.creator, theme: doc.theme };

  return (
    <MediaCtx.Provider value={{ slug }}>
    <EdCtx.Provider value={ed}>
      <div className="ed" data-preview={preview}>
        <header className="ed-top">
          <Link href={`/studio/${slug}`} className="ed-back" aria-label="Back to studio">←</Link>
          <input className="ed-name" aria-label="Site name" value={doc.name} maxLength={60} onChange={(e) => commit((d) => ({ ...d, name: e.target.value }), "name")} />
          <PageSwitcher pages={doc.pages} pageId={pageId} onSwitch={setPage} onAdd={addPage} />
          <div className="ed-sp" />
          <Seg label="Device" value={device} options={[{ value: "desktop", label: "Desktop" }, { value: "tablet", label: "Tablet" }, { value: "mobile", label: "Phone" }]} onChange={setDevice} />
          <div className="ed-sp" />
          <button className="btn sm" type="button" onClick={undo} disabled={!hist.current.past.length} title="Undo (⌘Z)" aria-label="Undo">↶</button>
          <button className="btn sm" type="button" onClick={redo} disabled={!hist.current.future.length} title="Redo (⇧⌘Z)" aria-label="Redo">↷</button>
          <button className="btn sm" type="button" aria-pressed={preview} onClick={() => setPreview((p) => !p)} title="Hide editing tools and try the page">{preview ? "Back to editing" : "Preview"}</button>
          <button className="btn sm" type="button" onClick={() => setHistoryOpen(true)} title="Earlier versions and scheduled publishes">History</button>
          <a className="btn sm" href={liveUrl} target="_blank" rel="noopener">View live ↗</a>
          {dirty ? <span className="pill wait"><span className="dot" />Unpublished</span> : <span className="pill ok"><span className="dot" />Published</span>}
          <ScheduleControl disabled={busy} onSchedule={(at) => schedule(docRef.current, at)} />
          <button className="btn gold sm" type="button" onClick={publishNow} disabled={busy || !dirty}>{busy ? "Publishing…" : "Publish"}</button>
        </header>

        <datalist id="link-targets">
          {["#courses", "#live", "#stories", "#about", "#faq", "/login", "/my-courses", ...doc.pages.map((p) => `/${p.slug}`)].map((l) => <option key={l} value={l} />)}
        </datalist>
        <div className="ed-body">
          {/* left: layers and library */}
          <aside className="ed-left" aria-label="Page structure">
            <Seg label="Left panel" value={left} options={[{ value: "layers", label: `Layers · ${curBlocks.length}` }, { value: "add", label: "Add" }, { value: "media", label: "Media" }]} onChange={(v) => { setLeft(v); if (v === "layers") setInsertIndex(null); }} />
            {left === "media" ? (
              <MediaLibrary slug={slug} />
            ) : left === "layers" ? (
              <DndContext id="layers-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  <ol className="layers">
                    {curBlocks.map((b) => <LayerRow key={b.id} block={b} selected={b.id === selectedId} onSelect={() => { select(b.id); scrollTo(b.id); }} />)}
                  </ol>
                </SortableContext>
                <button type="button" className="btn sm" onClick={() => { setInsertIndex(null); setSelectedId(null); setLeft("add"); }}>+ Add section</button>
              </DndContext>
            ) : (
              <AddPanel where={where} slug={slug} canTemplate={pageId === HOME} ai={aiEnabled && pageId === HOME ? writeWithAi : undefined} savedTick={savedTick} onAdd={addBlock} onAddCustom={addCustom} onTemplate={applyTemplate} />
            )}
          </aside>

          {/* centre: the live page */}
          <main className="ed-stage">
            {restored && (
              <div className="ed-banner" role="status">
                Restored your unpublished changes from this browser.
                <button type="button" className="btn sm" onClick={() => { setDoc(JSON.parse(saved)); hist.current = { past: [], future: [], key: "", at: 0 }; setRestored(false); bump(); }}>Discard them</button>
                <button type="button" className="btn sm" onClick={() => setRestored(false)}>Keep</button>
              </div>
            )}
            <div className={`ed-device ed-${device}`}>
              <div className="ed-scroll" ref={scroller} data-reordering={reordering} onPointerDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
                <SiteProvider value={{ site: pub, courses, facts, editor, course: pageId === COURSE ? (courses[0] ?? null) : null }}>
                  <ThemeScope theme={doc.theme} className="site-root ed-site">
                    <SiteNav site={navSite} blocks={doc.blocks} chrome={doc.chrome} pages={doc.pages} preview />
                    <DndContext id="canvas-dnd" sensors={sensors} collisionDetection={closestCenter} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }} onDragStart={() => setReordering(true)} onDragEnd={onDragEnd} onDragCancel={() => setReordering(false)}>
                      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                        <main>
                          <PageBlocks blocks={curBlocks} />
                        </main>
                      </SortableContext>
                    </DndContext>
                    <button type="button" className="ed-add-end" onClick={() => ed.insertAt(curBlocks.length)}>+ Add section</button>
                    <SiteFooter site={navSite} host={host} chrome={doc.chrome} preview />
                  </ThemeScope>
                </SiteProvider>
              </div>
              {popupPreview && (
                <div className="brand sf ed-popwrap" style={themeVars(doc.theme)}>
                  <SitePopup popup={doc.chrome.popup} siteId={site.id} preview onClose={() => setPopupPreview(false)} />
                </div>
              )}
            </div>
            <p className="ed-narrow">The site editor works best on a laptop or tablet.</p>
          </main>

          {/* right: inspector */}
          <aside className="ed-right" aria-label="Settings">
            <Seg label="Right panel" value={right} options={[{ value: "block", label: "Section" }, { value: "design", label: "Design" }, { value: "site", label: "Site" }, { value: "page", label: "Page" }]} onChange={setRight} />
            {right === "design" ? (
              <DesignPanel theme={doc.theme} onTheme={setTheme} />
            ) : right === "page" ? (
              <PageSettings
                pageId={pageId}
                page={curPage}
                index={doc.pages.findIndex((p) => p.id === pageId)}
                count={doc.pages.length}
                host={host}
                others={slugsExcept(pageId)}
                onChange={(patch, key) => updatePage(pageId, patch, key)}
                onMove={(dir) => movePage(pageId, dir)}
                onDuplicate={() => duplicatePage(pageId)}
                onDelete={() => deletePage(pageId)}
              />
            ) : right === "site" ? (
              <SiteSettings chrome={doc.chrome} theme={doc.theme} blocks={doc.blocks} pages={doc.pages} onPreviewPopup={() => setPopupPreview(true)} onChrome={setChrome} onTheme={setTheme} />
            ) : selected?.type === "custom" ? (
              <CustomInspector
                key={selected.id}
                block={selected}
                selectedElId={selEl?.blockId === selected.id ? selEl.elId : null}
                onChange={(fn, key) => updateCustom(selected.id, fn, key)}
                onSelectEl={(elId) => setSelEl(elId ? { blockId: selected.id, elId } : null)}
                onTone={(tone) => mapBlocks((b) => b.map((x) => (x.id === selected.id ? { ...x, tone } : x)))}
                onDuplicate={() => ed.duplicate(selected.id)}
                onRemove={() => ed.remove(selected.id)}
                onToggleHidden={() => ed.toggleHidden(selected.id)}
                onSaveSection={(name) => saveMySection(selected, name)}
              />
            ) : selected ? (
              <BlockInspector
                key={selected.id}
                block={selected}
                onProp={(path, value) => setProp(selected.id, path, value)}
                onTone={(tone) => mapBlocks((b) => b.map((x) => (x.id === selected.id ? { ...x, tone } : x)))}
                onDuplicate={() => ed.duplicate(selected.id)}
                onRemove={() => ed.remove(selected.id)}
                onToggleHidden={() => ed.toggleHidden(selected.id)}
              />
            ) : (
              <div className="insp empty-insp">
                <b>Nothing selected</b>
                <p>Click a section on the page, or pick one in Layers, to change its text, style and colour. Drag the ⠿ handle to move it.</p>
                <div className="insp-actions">
                  <button type="button" className="btn sm" onClick={() => setRight("design")}>Open design settings</button>
                  <button type="button" className="btn sm" onClick={() => setRight("site")}>Logo, menu and footer</button>
                </div>
              </div>
            )}
          </aside>
        </div>

        {historyOpen && <HistoryModal slug={slug} dirty={dirty} onRestore={restoreSnapshot} onCancelSchedule={cancelSchedule} onClose={() => setHistoryOpen(false)} />}
        {note && <div className={`toast ed-toast ${note.tone}`} role="status">{note.text}</div>}
      </div>
    </EdCtx.Provider>
    </MediaCtx.Provider>
  );
}
