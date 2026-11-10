"use client";

import { useEffect, useRef, useState } from "react";
import { COURSE, HOME, MAX_PAGES, RESERVED_SLUGS, uniqueSlug } from "@/lib/pages";
import type { SitePage } from "@/lib/types";
import { Row, Switch } from "./editor-panels";

// Pages in the editor: a switcher in the top bar (Home, your pages, the course template) and a "Page"
// panel for the one being edited: title, address, search description, menu, order, copy and delete.

type SwitcherProps = {
  pages: SitePage[];
  pageId: string;
  onSwitch: (id: string) => void;
  onAdd: (title: string) => void;
};

export const pageName = (pages: SitePage[], id: string) => (id === HOME ? "Home" : id === COURSE ? "Course pages" : (pages.find((p) => p.id === id)?.title ?? "Page"));

export function PageSwitcher({ pages, pageId, onSwitch, onAdd }: SwitcherProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
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

  const pick = (id: string) => {
    onSwitch(id);
    setOpen(false);
  };

  return (
    <div className="pagesw" ref={box}>
      <button type="button" className="btn sm pagesw-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="Switch page">
        <span className="pagesw-k">Page</span> {pageName(pages, pageId)} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="pagemenu" role="listbox" aria-label="Pages">
          <button type="button" role="option" aria-selected={pageId === HOME} onClick={() => pick(HOME)}><b>Home</b><small>/</small></button>
          {pages.map((p) => (
            <button key={p.id} type="button" role="option" aria-selected={pageId === p.id} onClick={() => pick(p.id)}>
              <b>{p.title}</b>
              <small>/{p.slug}{p.inMenu ? "" : " · not in menu"}</small>
            </button>
          ))}
          <hr />
          <button type="button" role="option" aria-selected={pageId === COURSE} onClick={() => pick(COURSE)}><b>Course pages</b><small>One design for every course</small></button>
          <hr />
          {pages.length < MAX_PAGES ? (
            <form
              className="pagenew"
              onSubmit={(e) => {
                e.preventDefault();
                const t = title.trim();
                if (!t) return;
                onAdd(t);
                setTitle("");
                setOpen(false);
              }}
            >
              <input className="input" aria-label="New page name" value={title} maxLength={60} placeholder="New page, like About" onChange={(e) => setTitle(e.target.value)} />
              <button className="btn sm gold" type="submit" disabled={!title.trim()}>Add</button>
            </form>
          ) : (
            <p className="hint" style={{ padding: "6px 10px" }}>You&apos;ve reached {MAX_PAGES} pages.</p>
          )}
        </div>
      )}
    </div>
  );
}

type PanelProps = {
  pageId: string;
  page: SitePage | null;
  index: number;
  count: number;
  host: string;
  others: ReadonlySet<string>;
  onChange: (patch: Partial<Pick<SitePage, "title" | "slug" | "description" | "inMenu">>, key?: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function PageSettings({ pageId, page, index, count, host, others, onChange, onMove, onDuplicate, onDelete }: PanelProps) {
  const [confirm, setConfirm] = useState(false);
  const [slug, setSlug] = useState(page?.slug ?? "");
  useEffect(() => setSlug(page?.slug ?? ""), [page?.id, page?.slug]);

  if (pageId === HOME) {
    return (
      <div className="insp">
        <div className="insp-head"><span className="insp-ico">⌂</span><div><b>Home page</b><span>The first thing visitors see, at your main address.</span></div></div>
        <p className="hint">Its title and search description come from your site name and the first Hero section. Add more pages with the page menu at the top.</p>
      </div>
    );
  }
  if (pageId === COURSE || !page) {
    return (
      <div className="insp">
        <div className="insp-head"><span className="insp-ico">◧</span><div><b>Course pages</b><span>One design shared by every course.</span></div></div>
        <p className="hint">The “Course details” block holds each course&apos;s title, lessons and reserve form. It stays put, but you can add sections above or below it and drag it around. Use “Course facts” to show the price, seats and lessons of whichever course is open, and “Course cards” to suggest other courses.</p>
      </div>
    );
  }

  const bad = !slug || RESERVED_SLUGS.has(slug) || others.has(slug);
  return (
    <div className="insp">
      <div className="insp-head"><span className="insp-ico">▭</span><div><b>{page.title}</b><span>An extra page of your site.</span></div></div>
      <Row label="Page name" hint="Shown in the menu and the browser tab.">
        <input className="input" value={page.title} maxLength={60} onChange={(e) => onChange({ title: e.target.value }, "ptitle")} />
      </Row>
      <Row label="Address" hint={bad ? (RESERVED_SLUGS.has(slug) ? "That address is used by the platform." : others.has(slug) ? "Another page already has that address." : "Type an address.") : `${host}/${slug}`}>
        <div className="slugrow">
          <span className="mono muted">/</span>
          <input
            className="input"
            value={slug}
            maxLength={40}
            aria-invalid={bad}
            onChange={(e) => {
              const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+/, "").slice(0, 40);
              setSlug(v);
              if (v && !RESERVED_SLUGS.has(v) && !others.has(v)) onChange({ slug: v.replace(/-+$/, "") || v }, "pslug");
            }}
            onBlur={() => {
              const fixed = uniqueSlug(slug || page.title, others);
              setSlug(fixed);
              onChange({ slug: fixed });
            }}
          />
        </div>
      </Row>
      <Row label="Search description" hint={`${page.description.length}/200. Shown in search results and link previews.`}>
        <textarea className="input prose" rows={3} value={page.description} maxLength={200} onChange={(e) => onChange({ description: e.target.value }, "pdesc")} />
      </Row>
      <Switch on={page.inMenu} onChange={(v) => onChange({ inMenu: v })} label="Show in the header menu" />
      {page.inMenu && <p className="hint">Needs “From my sections” menu links. With your own links, add this page by hand.</p>}
      <div className="insp-actions">
        <button className="btn sm" type="button" disabled={index === 0} onClick={() => onMove(-1)}>Move earlier</button>
        <button className="btn sm" type="button" disabled={index === count - 1} onClick={() => onMove(1)}>Move later</button>
        <button className="btn sm" type="button" disabled={count >= MAX_PAGES} onClick={onDuplicate}>Duplicate</button>
        {confirm ? (
          <>
            <button className="btn sm danger" type="button" onClick={onDelete}>Yes, delete page</button>
            <button className="btn sm" type="button" onClick={() => setConfirm(false)}>Keep</button>
          </>
        ) : (
          <button className="btn sm danger" type="button" onClick={() => setConfirm(true)}>Delete page</button>
        )}
      </div>
      <p className="hint">Deleting is undone with ⌘Z until you publish.</p>
    </div>
  );
}
