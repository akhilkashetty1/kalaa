"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isExternal, linkTarget } from "@/lib/chrome";
import type { SiteChrome } from "@/lib/types";

// The site's pop-up: appears once the page has been open a few seconds. A visitor who closes it isn't
// nagged: it comes back once a day, never again, or on every visit, as the teacher chose (remembered in
// this browser only). It never shows on sign-in or lesson pages, and Esc closes it.

type Popup = SiteChrome["popup"];

/** A short fingerprint of the message, so changing the pop-up shows it again to people who closed the old one. */
const signature = (p: Popup) => {
  let h = 5381;
  for (const ch of `${p.title}|${p.text}|${p.buttonLabel}|${p.buttonHref}`) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
};

const QUIET_PATHS = ["/learn", "/login", "/my-courses"];

export function SitePopup({ popup, siteId, preview = false, onClose }: { popup: Popup; siteId: string; preview?: boolean; onClose?: () => void }) {
  const path = usePathname();
  const [open, setOpen] = useState(preview);
  const box = useRef<HTMLDivElement>(null);
  const key = `kalaa-popup:${siteId}:${signature(popup)}`;

  useEffect(() => {
    if (preview || !popup.enabled || QUIET_PATHS.some((p) => path.startsWith(p))) return;
    try {
      const last = Number(localStorage.getItem(key) ?? 0);
      if (popup.repeat === "once" && last) return;
      if (popup.repeat === "daily" && Date.now() - last < 24 * 60 * 60 * 1000) return;
    } catch {
      /* storage blocked: show it, it just can't be remembered */
    }
    const id = setTimeout(() => setOpen(true), popup.delay * 1000);
    return () => clearTimeout(id);
  }, [popup, path, key, preview]);

  const close = () => {
    setOpen(false);
    try {
      if (!preview) localStorage.setItem(key, String(Date.now()));
    } catch {
      /* ignore */
    }
    onClose?.();
  };

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>("a, button")];
      if (!items.length) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const href = popup.buttonHref ? linkTarget(popup.buttonHref) : "";
  return (
    <div className="sf-popup-back" data-preview={preview} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sf-popup" ref={box} role="dialog" aria-modal="true" aria-labelledby="sf-popup-title">
        <button type="button" className="sf-popup-x" aria-label="Close" onClick={close}>✕</button>
        {popup.title && <h2 id="sf-popup-title">{popup.title}</h2>}
        {popup.text && <p>{popup.text}</p>}
        {popup.buttonLabel && href && (
          <a className="bbtn" href={preview ? undefined : href} onClick={(e) => (preview ? e.preventDefault() : close())} {...(isExternal(popup.buttonHref) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {popup.buttonLabel}
          </a>
        )}
      </div>
    </div>
  );
}
