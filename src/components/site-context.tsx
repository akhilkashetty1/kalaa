"use client";

import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import type { Block, Course } from "@/lib/types";

/** The few site fields blocks need. Deliberately not the whole Site, which holds owner ids and domain state. */
export type PublicSite = { name: string; slug: string; creator: { name: string; title: string; rating: number }; theme: Theme };

/** Provided by the visual editor. When absent the page is the live site: plain, with no editing. */
export type EditorApi = {
  selectedId: string | null;
  select: (id: string | null) => void;
  /** Sets one field of a block. `path` can reach into a list: "items.2.title". */
  setProp: (blockId: string, path: string, value: unknown) => void;
  /** The editor's wrapper for a block: selection outline, toolbar and drag handle. */
  Frame: ComponentType<{ block: Block; index: number; className: string; anchor?: string; children: ReactNode }>;
};

export type SiteCtxValue = { site: PublicSite; courses: Course[]; editor: EditorApi | null };

const Ctx = createContext<SiteCtxValue | null>(null);

export function SiteProvider({ value, children }: { value: SiteCtxValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSite must be used inside SiteProvider");
  return { ...v, theme: v.site.theme };
}
