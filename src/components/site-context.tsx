"use client";

import { createContext, useContext, type ComponentType, type ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import type { Block, PublicCourse } from "@/lib/types";

/** The few site fields blocks need. Deliberately not the whole Site, which holds owner ids and domain state. */
export type PublicSite = { name: string; slug: string; creator: { name: string; title: string; rating: number }; theme: Theme };

/** Provided by the visual editor. When absent the page is the live site: plain, with no editing. */
export type EditorApi = {
  selectedId: string | null;
  /** The element selected inside a custom section, if any. */
  selectedElId: string | null;
  select: (id: string | null) => void;
  /** Selects an element inside a custom section (and that section with it). */
  selectEl: (blockId: string, elId: string) => void;
  /** Sets one field of a block. `path` can reach into a list: "items.2.title". */
  setProp: (blockId: string, path: string, value: unknown) => void;
  /** The editor's wrapper for a block: selection outline, toolbar and drag handle. */
  Frame: ComponentType<{ block: Block; index: number; className: string; anchor?: string; children: ReactNode }>;
};

/** Counts about the site for data-bound elements. Mirrors server/data/public.ts. */
export type SiteFacts = { students: number; courses: number; lessons: number; hours: number };

export type SiteCtxValue = {
  site: PublicSite;
  courses: PublicCourse[];
  facts: SiteFacts;
  editor: EditorApi | null;
  /** The course being shown, on course pages and in the course template preview. Elements like "course facts" read it. */
  course?: PublicCourse | null;
};

const Ctx = createContext<SiteCtxValue | null>(null);

export function SiteProvider({ value, children }: { value: SiteCtxValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Adds the current course to the context for everything inside it. Used by course pages. */
export function CourseScope({ course, children }: { course: PublicCourse | null; children: ReactNode }) {
  const outer = useContext(Ctx);
  if (!outer) throw new Error("CourseScope must be used inside SiteProvider");
  return <Ctx.Provider value={{ ...outer, course }}>{children}</Ctx.Provider>;
}

export function useSite() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSite must be used inside SiteProvider");
  return { ...v, theme: v.site.theme };
}
