"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fades a block of the home page in as it scrolls into view. Content is visible without JavaScript. */
export function Rv({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`mk-rv${on ? " in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/** Cycles through words in the headline, to show how many kinds of teacher Kalaa is for. */
export function Rotating({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % words.length), 2200);
    return () => clearInterval(id);
  }, [words.length]);
  return (
    <span className="mk-rot" aria-live="off">
      <span key={i} className="mk-rot-w">{words[i]}</span>
    </span>
  );
}
