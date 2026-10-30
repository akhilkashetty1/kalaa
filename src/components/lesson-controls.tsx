"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLessonComplete, visitLesson } from "@/app/sites/[site]/progress-actions";

/** Marks a lesson done and moves on. Also remembers the visit, so the library can offer "continue". */
export function LessonControls({ course, index, total, done, signedIn, labels }: { course: string; index: number; total: number; done: boolean; signedIn: boolean; labels: { complete: string; completed: string; completeNext: string; finish: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (signedIn) void visitLesson(course, index);
  }, [signedIn, course, index]);

  if (!signedIn) return null;
  const last = index >= total;

  const mark = (value: boolean, thenNext = false) =>
    start(async () => {
      const res = await setLessonComplete(course, index, value);
      if (!res.ok) return;
      // A full navigation, so the storefront host rewrite applies to the next lesson.
      if (thenNext) window.location.assign(last ? "/my-courses" : `/learn/${course}?lesson=${index + 1}`);
      else router.refresh();
    });

  return (
    <div className="lp-done">
      <button type="button" className={`bbtn ghost sm${done ? " is-done" : ""}`} disabled={pending} aria-pressed={done} onClick={() => mark(!done)}>
        {done ? `✓ ${labels.completed}` : labels.complete}
      </button>
      <button type="button" className="bbtn sm" disabled={pending} onClick={() => mark(true, true)}>
        {last ? labels.finish : labels.completeNext} →
      </button>
    </div>
  );
}
