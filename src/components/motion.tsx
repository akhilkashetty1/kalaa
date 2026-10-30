"use client";

import { createElement, useEffect, useRef, useState, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import type { Motion } from "@/lib/theme";
import { useSite } from "./site-context";

// Animation primitives for the storefront. Everything respects the site's motion setting
// (off / calm / rich) and the visitor's "reduce motion" preference. Scroll effects use one
// capturing listener rather than CSS scroll timelines, which Firefox doesn't ship by default.

export function useMotion(): Motion {
  const { theme } = useSite();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced ? "off" : theme.motion;
}

/** Runs `fn` on scroll and resize (rAF-throttled), for scrolling in the window or in any container, such as the editor canvas. */
function useOnScroll(fn: () => void, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      ref.current();
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(run);
    };
    run();
    document.addEventListener("scroll", on, { capture: true, passive: true });
    window.addEventListener("resize", on);
    return () => {
      document.removeEventListener("scroll", on, { capture: true });
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled]);
}

function useInView<T extends Element>(once = true, margin = "0px 0px -6% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          if (once) io.disconnect();
        } else if (!once) setSeen(false);
      },
      { threshold: 0.12, rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, margin]);
  return [ref, seen] as const;
}

type RevealProps = { as?: ElementType; variant?: "up" | "fade" | "words" | "scale" | "mask"; delay?: number; className?: string; style?: CSSProperties; children?: ReactNode } & Omit<HTMLAttributes<HTMLElement>, "children">;

/** Fades its content in when it scrolls into view. */
export function Reveal({ as = "div", variant = "up", delay = 0, className = "", style, children, ...rest }: RevealProps) {
  const [ref, seen] = useInView<HTMLElement>();
  return createElement(as, { ref, className: `rv${seen ? " in" : ""} ${className}`.trim(), "data-rv": variant, style: { "--d": `${delay}ms`, ...style }, ...rest }, children);
}

/** Splits "plain text with *accent* words" into one animated span per word. */
export function Words({ text }: { text: string }) {
  let i = 0;
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return (
    <>
      {parts.flatMap((part, pi) => {
        const em = part.length > 2 && part.startsWith("*") && part.endsWith("*");
        return (em ? part.slice(1, -1) : part).split(/(\s+)/).map((w, wi) =>
          w.trim() === "" ? (
            w
          ) : (
            <span key={`${pi}-${wi}`} className="wd" style={{ "--i": i++ } as CSSProperties}>
              {em ? <em>{w}</em> : w}
            </span>
          ),
        );
      })}
    </>
  );
}

/** Plain text with *accent* words, no animation. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/g).map((part, i) => (part.length > 2 && part.startsWith("*") && part.endsWith("*") ? <em key={i}>{part.slice(1, -1)}</em> : part))}
    </>
  );
}

/** A paragraph whose words go from blurred and dim to sharp as it scrolls through the screen. */
export function ScrollWords({ text, className = "" }: { text: string; className?: string }) {
  const motion = useMotion();
  const ref = useRef<HTMLParagraphElement>(null);
  useOnScroll(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = (vh * 0.9 - r.top) / (vh * 0.5 + r.height * 0.6);
    el.style.setProperty("--p", String(Math.min(1, Math.max(0, p))));
  }, motion !== "off");

  const words: { w: string; em: boolean }[] = text.split(/(\*[^*]+\*)/g).filter(Boolean).flatMap((part) => {
    const em = part.length > 2 && part.startsWith("*") && part.endsWith("*");
    return (em ? part.slice(1, -1) : part).split(/\s+/).filter(Boolean).map((w) => ({ w, em }));
  });
  return (
    <p ref={ref} className={`sw ${className}`}>
      {words.map(({ w, em }, i) => (
        <span key={i} style={{ "--w": (i / words.length).toFixed(3) } as CSSProperties}>
          {em ? <em>{w}</em> : w}{" "}
        </span>
      ))}
    </p>
  );
}

/** Counts a number up when it scrolls into view. "18,400+" becomes 0 → 18,400 followed by "+". */
export function CountUp({ value }: { value: string }) {
  const motion = useMotion();
  const [ref, seen] = useInView<HTMLSpanElement>();
  const m = value.match(/^([^\d]*)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!seen || !m || motion === "off") return;
    const target = Number(m[2].replace(/,/g, ""));
    const decimals = m[2].includes(".") ? m[2].split(".")[1].length : 0;
    const grouped = m[2].includes(",");
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 1600);
      const eased = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
      const n = target * eased;
      setShown(`${m[1]}${grouped ? n.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) : n.toFixed(decimals)}${m[3]}`);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, value, motion]);
  return <span ref={ref} className="num">{shown ?? value}</span>;
}

/** Tilts toward the pointer in 3D, with a moving highlight. Does nothing on touch or with motion off. */
export function Tilt({ as = "div", max = 9, className = "", children, ...rest }: { as?: ElementType; max?: number; className?: string; children?: ReactNode } & Omit<HTMLAttributes<HTMLElement>, "children">) {
  const motion = useMotion();
  const ref = useRef<HTMLElement>(null);
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || motion === "off" || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${((0.5 - y) * max).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((x - 0.5) * max).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
  };
  const leave = () => {
    const el = ref.current;
    if (!el) return;
    for (const k of ["--rx", "--ry"]) el.style.removeProperty(k);
  };
  return createElement(as, { ref, className: `tilt ${className}`, onPointerMove: move, onPointerLeave: leave, ...rest }, children);
}

/** Pulls a button slightly toward the pointer. Only in "rich" motion. */
export function Magnetic({ children }: { children: ReactNode }) {
  const motion = useMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || motion !== "rich" || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${((e.clientX - (r.left + r.width / 2)) * 0.22).toFixed(1)}px, ${((e.clientY - (r.top + r.height / 2)) * 0.3).toFixed(1)}px)`;
  };
  return (
    <span ref={ref} className="mag" onPointerMove={move} onPointerLeave={() => ref.current && (ref.current.style.transform = "")}>
      {children}
    </span>
  );
}

/** Exposes how far the element is from the middle of the screen as `--sp` (-1 above … 1 below), for parallax in CSS. */
export function ScrollVars({ as = "div", className = "", children, ...rest }: { as?: ElementType; className?: string; children?: ReactNode } & Omit<HTMLAttributes<HTMLElement>, "children">) {
  const motion = useMotion();
  const ref = useRef<HTMLElement>(null);
  useOnScroll(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    el.style.setProperty("--sp", String(Math.max(-1.5, Math.min(1.5, (r.top + r.height / 2 - vh / 2) / vh)).toFixed(3)));
  }, motion !== "off");
  return createElement(as, { ref, className, ...rest }, children);
}

/** Lights up the area under the pointer inside a card, via --mx/--my. */
export function Spot({ as = "div", className = "", children, ...rest }: { as?: ElementType; className?: string; children?: ReactNode } & Omit<HTMLAttributes<HTMLElement>, "children">) {
  const { theme } = useSite();
  const ref = useRef<HTMLElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !theme.glow) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return createElement(as, { ref, className: `spot ${className}`, onPointerMove: move, ...rest }, children);
}
