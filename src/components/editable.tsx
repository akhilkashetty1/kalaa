"use client";

import { createElement, useRef, type ElementType } from "react";
import { useSite } from "./site-context";

// Click-to-edit text on the editor canvas. The text shows exactly as it will on the live page, with
// accent words styled. ⌘/Ctrl+I toggles accent on the selection. Stored as plain text with *stars*.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (text: string) => esc(text).replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\n/g, "<br>");

function toMarkup(root: HTMLElement, multiline: boolean): string {
  let out = "";
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      out += (n.textContent ?? "").replace(/ /g, " ");
      return;
    }
    if (!(n instanceof HTMLElement)) return;
    if (n.tagName === "BR") {
      out += multiline ? "\n" : " ";
      return;
    }
    const isBlock = n.tagName === "DIV" || n.tagName === "P";
    if (isBlock && out && !out.endsWith("\n")) out += multiline ? "\n" : " ";
    const em = n.tagName === "EM" || n.tagName === "I" || n.style.fontStyle === "italic";
    if (em) out += "*";
    n.childNodes.forEach(walk);
    if (em) out += "*";
  };
  root.childNodes.forEach(walk);
  return out.replace(/\*\*/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

type Props = { blockId: string; path: string; value: string; as?: ElementType; className?: string; multiline?: boolean; max?: number; placeholder?: string };

export function Editable({ blockId, path, value, as = "span", className = "", multiline = false, max = 200, placeholder = "Type here" }: Props) {
  const { editor } = useSite();
  const ref = useRef<HTMLElement>(null);
  if (!editor) return null;

  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next = toMarkup(el, multiline).slice(0, max);
    if (next !== value) editor.setProp(blockId, path, next);
    else el.innerHTML = toHtml(value); // tidy any stray markup
  };

  return createElement(as, {
    ref,
    className: `ed-text ${className}`,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    "data-placeholder": placeholder,
    dangerouslySetInnerHTML: { __html: toHtml(value) },
    onFocus: () => editor.select(blockId),
    onBlur: commit,
    onClick: (e: React.MouseEvent) => e.preventDefault(),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      e.stopPropagation(); // typing must not trigger the editor's own shortcuts
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Enter" && !multiline) {
        e.preventDefault();
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        e.currentTarget.innerHTML = toHtml(value);
        e.currentTarget.blur();
      } else if (mod && e.key.toLowerCase() === "i") {
        e.preventDefault();
        document.execCommand("italic");
      } else if (mod && (e.key.toLowerCase() === "b" || e.key.toLowerCase() === "u")) e.preventDefault();
    },
    onPaste: (e: React.ClipboardEvent) => {
      e.preventDefault();
      document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s*\n+\s*/g, multiline ? "\n" : " "));
    },
  });
}
