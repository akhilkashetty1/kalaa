import { safeImageUrl } from "./media";

// The field system behind every editable thing: ready-made sections (lib/blocks.ts) and page-builder
// elements (lib/custom.ts) both declare their fields once, and that single declaration drives the
// inspector form, the defaults and the server-side validation. Pure data and functions, safe anywhere.

export type Base = { key: string; label: string; hint?: string };
export type Leaf =
  | (Base & { kind: "text"; max: number; default: string; placeholder?: string })
  | (Base & { kind: "textarea"; max: number; default: string })
  | (Base & { kind: "select"; options: readonly { value: string; label: string }[]; default: string })
  | (Base & { kind: "toggle"; default: boolean })
  | (Base & { kind: "link"; default: string })
  | (Base & { kind: "image"; default: string })
  | (Base & { kind: "date"; default: string })
  | (Base & { kind: "number"; min: number; max: number; default: number });
export type Field = Leaf | (Base & { kind: "list"; max: number; itemLabel: string; fields: Leaf[]; default: Record<string, unknown>[] });


export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export const SAFE_LINK = /^(#[\w-]{0,40}|\/(?!\/)[\w\-./?=&#%]{0,200}|https:\/\/[^\s<>"']{1,280})$/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, max) : "");

function leaf(f: Leaf, v: unknown): string | number | boolean {
  switch (f.kind) {
    case "text":
      return str(v, f.max).replace(/\s*\n+\s*/g, " ").trim();
    case "textarea":
      return str(v, f.max).trim();
    case "select":
      return f.options.some((o) => o.value === v) ? (v as string) : f.default;
    case "toggle":
      return v === true;
    case "link": {
      const s = str(v, 300).trim();
      return s === "" || SAFE_LINK.test(s) ? s : "";
    }
    case "image":
      return safeImageUrl(v);
    case "date":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : f.default;
    case "number": {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.min(f.max, Math.max(f.min, n)) : f.default;
    }
  }
}

/** Validates `input` against a field list: unknown keys dropped, strings capped, links and images checked. */
export function sanitizeFields(fields: readonly Field[], input: unknown): Record<string, unknown> {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = src[f.key];
    if (f.kind === "list") {
      const arr = Array.isArray(v) ? v.slice(0, f.max) : clone(f.default);
      out[f.key] = arr.map((item) => {
        const o = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        return Object.fromEntries(f.fields.map((lf) => [lf.key, leaf(lf, o[lf.key])]));
      });
    } else {
      out[f.key] = v === undefined ? clone(f.default) : leaf(f, v);
    }
  }
  return out;
}


/** The default value of every field in a list. Block types and page-builder elements both use it. */
export function defaultsFor(fields: readonly Field[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f.key, clone(f.default)]));
}


export const fText = (key: string, label: string, max: number, def = "", extra: Partial<Base & { placeholder: string }> = {}): Leaf => ({ kind: "text", key, label, max, default: def, ...extra });
export const fArea = (key: string, label: string, max: number, def = ""): Leaf => ({ kind: "textarea", key, label, max, default: def });
export const fSelect = (key: string, label: string, options: readonly [string, string][], def: string): Leaf => ({ kind: "select", key, label, options: options.map(([value, l]) => ({ value, label: l })), default: def });
export const fLink = (key: string, label: string, def = ""): Leaf => ({ kind: "link", key, label, default: def });
export const fImage = (key: string, label: string): Leaf => ({ kind: "image", key, label, default: "" });
export const fToggle = (key: string, label: string, def = false): Leaf => ({ kind: "toggle", key, label, default: def });
export const fNumber = (key: string, label: string, min: number, max: number, def: number): Leaf => ({ kind: "number", key, label, min, max, default: def });
export const fDate = (key: string, label: string, def: string): Leaf => ({ kind: "date", key, label, default: def });
