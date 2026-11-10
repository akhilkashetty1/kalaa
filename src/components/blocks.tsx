"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fieldFor, getPath } from "@/lib/blocks";
import { customOf, sectionClasses } from "@/lib/custom";
import { inr, t as tr } from "@/lib/i18n";
import { mixHex, paletteOf } from "@/lib/theme";
import type { Block, PublicCourse } from "@/lib/types";
import { CustomBg, CustomSection } from "./custom-block";
import { Editable } from "./editable";
import { CountUp, Magnetic, Reveal, Rich, ScrollVars, ScrollWords, Spot, Tilt, Words, useMotion } from "./motion";
import { ShaderCanvas } from "./shaders";
import { useSite } from "./site-context";

// The storefront's blocks. The same components render the live site and the editor canvas: on the
// live site text is animated and links work, in the editor text becomes click-to-edit and links are inert.

type Item = Record<string, string | number>;
const list = (b: Block, key: string) => ((b.props[key] as Item[]) ?? []) as Item[];
const val = (b: Block, path: string) => String(getPath(b.props, path) ?? "");

/** A piece of text from a block: animated on the live site, click-to-edit in the editor. */
function T({ b, path, as = "p", kind = "plain", className = "", delay = 0 }: { b: Block; path: string; as?: "p" | "h1" | "h2" | "h3" | "span" | "div" | "blockquote" | "small" | "b"; kind?: "plain" | "heading"; className?: string; delay?: number }) {
  const { editor } = useSite();
  const value = val(b, path);
  const def = fieldFor(b.type, path);
  if (editor) {
    return <Editable blockId={b.id} path={path} value={value} as={as} className={className} multiline={def?.kind === "textarea"} max={def && "max" in def ? def.max : 200} placeholder={def?.label ?? "Type here"} />;
  }
  if (!value) return null;
  if (kind === "heading") {
    return (
      <Reveal as={as} variant="words" className={className}>
        <Words text={value} />
      </Reveal>
    );
  }
  return (
    <Reveal as={as} delay={delay} className={className}>
      <Rich text={value} />
    </Reveal>
  );
}

/** A link styled as a button. */
function Btn({ b, label, href, ghost = false }: { b: Block; label: string; href: string; ghost?: boolean }) {
  const { editor } = useSite();
  const text = val(b, label);
  if (!text && !editor) return null;
  const target = val(b, href) || "#";
  if (editor) {
    return (
      <a className={`bbtn${ghost ? " ghost" : ""}`} href={target} onClick={(e) => e.preventDefault()}>
        <T b={b} path={label} as="span" />
      </a>
    );
  }
  const external = target.startsWith("https://");
  return (
    <Magnetic>
      <a className={`bbtn${ghost ? " ghost" : ""}`} href={target} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {text}
      </a>
    </Magnetic>
  );
}

const coverBg = (i: number) =>
  [
    "radial-gradient(120% 120% at 15% 0%, var(--b-accent), transparent 62%), radial-gradient(90% 90% at 100% 100%, var(--b-accent2), transparent 58%), var(--b-surface)",
    "conic-gradient(from 210deg at 72% 28%, var(--b-accent), var(--b-surface), var(--b-accent2), var(--b-surface), var(--b-accent))",
    "repeating-linear-gradient(115deg, color-mix(in oklab, var(--b-ink) 14%, transparent) 0 2px, transparent 2px 18px), linear-gradient(145deg, var(--b-accent2), var(--b-surface) 62%)",
    "radial-gradient(70% 90% at 80% 20%, var(--b-accent2), transparent 60%), linear-gradient(200deg, var(--b-accent), var(--b-surface) 70%)",
  ][i % 4];

type CardCourse = PublicCourse;
const SAMPLE_COURSES: CardCourse[] = ["Foundations", "Core concepts", "Problem lab", "Mock tests", "Masterclass"].map((title, i) => ({ id: `s${i}`, slug: "", title, summary: "Your course appears here once you create and publish it.", priceInr: 1999 + i * 500, tag: undefined, lessons: [] }));

function CourseCardX({ course, i }: { course: CardCourse; i: number }) {
  const { theme, editor } = useSite();
  const s = tr(theme.lang);
  const href = course.slug ? `/courses/${course.slug}` : "#";
  return (
    <Tilt as="article" className="c-card">
      <div className="c-cover" style={{ background: coverBg(i) }}>
        <span className="c-n">{String(i + 1).padStart(2, "0")}</span>
        {course.tag && <span className="c-tag">{course.tag}</span>}
      </div>
      <div className="c-body">
        <h3>{course.title}</h3>
        {course.summary && <p>{course.summary}</p>}
        <div className="c-foot">
          <span><b className="num">{inr(course.priceInr)}</b>{course.mrpInr && course.mrpInr > course.priceInr && <s>{inr(course.mrpInr)}</s>}</span>
          <span className="c-go">{s.enroll} →</span>
        </div>
      </div>
      <a className="c-link" href={href} aria-label={course.title} onClick={editor ? (e) => e.preventDefault() : undefined} />
    </Tilt>
  );
}

/** Cards on a curved path in 3D. Drag to spin; it drifts slowly when idle. */
function CourseArc({ courses }: { courses: PublicCourse[] }) {
  const { theme, editor } = useSite();
  const motion = useMotion();
  const root = useRef<HTMLDivElement>(null);
  const base: CardCourse[] = courses.length ? courses : SAMPLE_COURSES;
  const cards = Array.from({ length: Math.max(base.length, Math.ceil(7 / base.length) * base.length) }, (_, i) => ({ c: base[i % base.length], i }));
  const n = cards.length;
  const wrap = (i: number, pos: number) => {
    const o = (((i - pos) % n) + n) % n;
    return o > n / 2 ? o - n : o;
  };
  const motionRef = useRef(motion);
  motionRef.current = motion;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>(".arc-card"));
    const st = { pos: 0, vel: 0, down: false, x: 0, moved: 0, visible: true };
    let raf = 0;
    let last = performance.now();
    const apply = () => nodes.forEach((c, i) => c.style.setProperty("--o", wrap(i, st.pos).toFixed(3)));
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      raf = 0;
      if (!st.down && motionRef.current !== "off") {
        st.pos += st.vel * dt;
        st.vel *= Math.pow(0.04, dt); // coast to a stop
        if (Math.abs(st.vel) < 0.15 && motionRef.current === "rich") st.pos += 0.16 * dt; // idle drift
      }
      apply();
      if (st.visible && (st.down || motionRef.current !== "off")) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      st.visible = e.isIntersecting;
      if (st.visible) kick();
    });
    io.observe(el);
    const spacing = () => el.clientWidth * 0.24;
    const down = (e: PointerEvent) => {
      st.down = true;
      st.x = e.clientX;
      st.moved = 0;
      st.vel = 0;
      el.setPointerCapture(e.pointerId);
      el.classList.add("grabbing");
      kick();
    };
    const move = (e: PointerEvent) => {
      if (!st.down) return;
      const dx = e.clientX - st.x;
      st.x = e.clientX;
      st.moved += Math.abs(dx);
      st.pos -= dx / spacing();
      st.vel = -(dx / spacing()) * 60;
    };
    const up = (e: PointerEvent) => {
      st.down = false;
      el.classList.remove("grabbing");
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      kick();
    };
    const click = (e: MouseEvent) => {
      if (st.moved > 6) {
        e.preventDefault();
        e.stopPropagation();
      }
      st.moved = 0;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    kick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, motion]);

  const s = tr(theme.lang);
  return (
    <ScrollVars className="arc-wrap">
      <div ref={root} className="arc" role="list" aria-label={s.courses}>
        {cards.map(({ c, i }) => (
          <a key={i} role="listitem" className="arc-card" draggable={false} href={c.slug ? `/courses/${c.slug}` : "#"} onClick={editor ? (e) => e.preventDefault() : undefined} style={{ "--o": wrap(i, 0).toFixed(3), background: coverBg(i) } as CSSProperties}>
            <span className="c-n">{String((i % base.length) + 1).padStart(2, "0")}</span>
            <span className="arc-info">
              <b>{c.title}</b>
              <small className="num">{inr(c.priceInr)}</small>
            </span>
          </a>
        ))}
      </div>
    </ScrollVars>
  );
}

const shaderColors = (theme: ReturnType<typeof useSite>["theme"]) => {
  const pal = paletteOf(theme);
  return { bg: pal.bg, a: theme.accent, b: theme.accent2 ?? mixHex(theme.accent, "#ffffff", 0.45), ink: pal.ink };
};

function Hero({ b }: { b: Block }) {
  const { theme, site, courses } = useSite();
  const v = val(b, "variant");
  const img = val(b, "imageUrl");
  return (
    <div className={`hero hero-${v}`}>
      <div className="hero-copy">
        <T b={b} path="eyebrow" as="p" className="pill-label" />
        <T b={b} path="headline" as="h1" kind="heading" className="h-xl" />
        <T b={b} path="body" as="p" className="lede" delay={140} />
        <Reveal className="ctas" delay={260}>
          <Btn b={b} label="ctaLabel" href="ctaHref" />
          <Btn b={b} label="cta2Label" href="cta2Href" ghost />
        </Reveal>
      </div>
      {v === "split" && (
        <Reveal variant="scale" className="hero-visual" delay={200}>
          <Tilt className="portrait-x" max={6}>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={site.creator.name} referrerPolicy="no-referrer" loading="lazy" />
            ) : (
              <div className="orbits" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ "--k": i } as CSSProperties} />)}
                <b />
              </div>
            )}
            <div className="portrait-cap"><strong>{site.creator.name}</strong><small>{site.creator.title}</small></div>
          </Tilt>
        </Reveal>
      )}
      {v === "orb" && (
        <ScrollVars className="orb-stage">
          <ShaderCanvas kind="orb" interactive colors={shaderColors(theme)} />
        </ScrollVars>
      )}
      {v === "arc" && <CourseArc courses={courses} />}
    </div>
  );
}

function Marquee({ b }: { b: Block }) {
  const items = list(b, "items").map((i) => String(i.text)).filter(Boolean);
  const { editor } = useSite();
  const base = items.length ? items : ["Add your words"];
  const run = base.length >= 6 ? base : [...base, ...base, ...base]; // long enough that the loop never shows a gap
  const track = (key: string) => (
    <ul key={key} aria-hidden={key !== "a"}>
      {run.map((t, i) => (
        <li key={i} className={i % 2 ? "alt" : ""}>{t}<span aria-hidden="true">✦</span></li>
      ))}
    </ul>
  );
  if (editor) {
    return (
      <div className="marquee static">
        <ul>
          {list(b, "items").map((it, i) => (
            <li key={i} className={i % 2 ? "alt" : ""}><T b={b} path={`items.${i}.text`} as="span" /><span aria-hidden="true">✦</span></li>
          ))}
        </ul>
      </div>
    );
  }
  return <div className="marquee" data-speed={val(b, "speed")}><div className="mq-track">{track("a")}{track("b")}</div></div>;
}

function Stats({ b }: { b: Block }) {
  const { editor } = useSite();
  const giant = val(b, "variant") === "giant";
  return (
    <div className={giant ? "stats-giant" : "stats-row"}>
      {list(b, "items").map((it, i) => (
        <Reveal key={i} className="stat" delay={i * 90}>
          <div className="stat-n">{editor ? <T b={b} path={`items.${i}.value`} as="span" /> : <CountUp value={String(it.value)} />}</div>
          <T b={b} path={`items.${i}.label`} as="div" className="stat-l" />
        </Reveal>
      ))}
    </div>
  );
}

function Statement({ b }: { b: Block }) {
  const { editor } = useSite();
  return (
    <div className="statement">
      <T b={b} path="eyebrow" as="p" className="eyebrow" />
      {editor ? <T b={b} path="text" as="p" className="sw sw-edit" /> : <ScrollWords text={val(b, "text")} />}
    </div>
  );
}

function SectionHead({ b }: { b: Block }) {
  return (
    <header className="sec-head">
      <T b={b} path="eyebrow" as="p" className="eyebrow" />
      <T b={b} path="title" as="h2" kind="heading" className="h-l" />
      <T b={b} path="subtitle" as="p" className="lede" delay={100} />
    </header>
  );
}

function Courses({ b }: { b: Block }) {
  const { courses, editor } = useSite();
  const layout = val(b, "layout");
  const shown: CardCourse[] = courses.length ? courses : SAMPLE_COURSES;
  if (!courses.length && !editor) return <SectionHead b={b} />;
  return (
    <>
      <SectionHead b={b} />
      {layout === "arc" ? (
        <CourseArc courses={courses} />
      ) : (
        <div className={layout === "rail" ? "c-rail" : "c-grid"}>
          {shown.map((c, i) => (
            <Reveal key={c.id} delay={Math.min(i, 5) * 80}><CourseCardX course={c} i={i} /></Reveal>
          ))}
        </div>
      )}
    </>
  );
}

function Features({ b }: { b: Block }) {
  return (
    <>
      <SectionHead b={b} />
      <div className="bento">
        {list(b, "items").map((it, i) => (
          <Reveal key={i} delay={Math.min(i, 5) * 80}>
            <Spot className="bento-card">
              <T b={b} path={`items.${i}.icon`} as="div" className="bento-icon" />
              <T b={b} path={`items.${i}.title`} as="h3" />
              <T b={b} path={`items.${i}.body`} as="p" />
            </Spot>
          </Reveal>
        ))}
      </div>
    </>
  );
}

function Steps({ b }: { b: Block }) {
  return (
    <>
      <SectionHead b={b} />
      <ol className="steps">
        {list(b, "items").map((it, i) => (
          <Reveal as="li" key={i} delay={i * 110} className="step-x">
            <span className="step-n" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <T b={b} path={`items.${i}.title`} as="h3" />
            <T b={b} path={`items.${i}.body`} as="p" />
          </Reveal>
        ))}
      </ol>
    </>
  );
}

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? { day: "--", mon: "" } : { day: String(d.getDate()).padStart(2, "0"), mon: d.toLocaleString("en-IN", { month: "short" }) };
};

function Live({ b }: { b: Block }) {
  const { theme } = useSite();
  const s = tr(theme.lang);
  return (
    <>
      <SectionHead b={b} />
      <div className="live-x">
        {list(b, "items").map((it, i) => {
          const d = fmtDate(String(it.date));
          return (
            <Reveal key={i} delay={i * 90} className="live-row-x">
              <div className="dt">{d.day}<small>{d.mon}</small></div>
              <div><T b={b} path={`items.${i}.title`} as="b" /><T b={b} path={`items.${i}.schedule`} as="span" /></div>
              <span className="seats">{it.seats} {s.seatsLeft}</span>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}

function Quotes({ b }: { b: Block }) {
  const { editor } = useSite();
  const motion = useMotion();
  const items = list(b, "items");
  const [at, setAt] = useState(0);
  const [hold, setHold] = useState(false);
  const spotlight = val(b, "variant") === "spotlight" && !editor && items.length > 1;
  useEffect(() => {
    if (!spotlight || motion === "off" || hold) return;
    const id = setInterval(() => setAt((a) => (a + 1) % items.length), 6500);
    return () => clearInterval(id);
  }, [spotlight, motion, hold, items.length]);

  return (
    <>
      <SectionHead b={b} />
      {spotlight ? (
        <div className="q-spot" onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)}>
          <div className="q-stage">
            {items.map((it, i) => (
              <figure key={i} className={i === at ? "on" : ""} aria-hidden={i !== at}>
                <blockquote>“{String(it.text)}”</blockquote>
                <figcaption><b>{String(it.author)}</b> <span>{String(it.detail)}</span></figcaption>
              </figure>
            ))}
          </div>
          <div className="q-dots" role="tablist">
            {items.map((_, i) => <button key={i} role="tab" aria-selected={i === at} aria-label={`Story ${i + 1}`} onClick={() => setAt(i)} />)}
          </div>
        </div>
      ) : (
        <div className="q-grid">
          {items.map((it, i) => (
            <Reveal as="figure" key={i} delay={i * 90} className="q-card">
              <T b={b} path={`items.${i}.text`} as="blockquote" />
              <figcaption><T b={b} path={`items.${i}.author`} as="b" /> <T b={b} path={`items.${i}.detail`} as="span" /></figcaption>
            </Reveal>
          ))}
        </div>
      )}
    </>
  );
}

function About({ b }: { b: Block }) {
  const { site } = useSite();
  const img = val(b, "imageUrl");
  return (
    <div className="about">
      <Reveal variant="scale" className="about-visual">
        <Tilt className="portrait-x" max={5}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={val(b, "name") || site.creator.name} referrerPolicy="no-referrer" loading="lazy" />
          ) : (
            <div className="orbits" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ "--k": i } as CSSProperties} />)}
              <b />
            </div>
          )}
          <div className="portrait-cap"><strong>{val(b, "name") || site.creator.name}</strong><small>{val(b, "role") || site.creator.title}</small></div>
        </Tilt>
      </Reveal>
      <div className="about-copy">
        <T b={b} path="eyebrow" as="p" className="eyebrow" />
        <T b={b} path="title" as="h2" kind="heading" className="h-l" />
        <T b={b} path="body" as="p" className="lede" delay={120} />
        <ul className="facts">
          {list(b, "items").map((_, i) => <li key={i}><T b={b} path={`items.${i}.text`} as="span" /></li>)}
        </ul>
      </div>
    </div>
  );
}

function Faq({ b }: { b: Block }) {
  const { editor } = useSite();
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      <header className="sec-head">
        <T b={b} path="eyebrow" as="p" className="eyebrow" />
        <T b={b} path="title" as="h2" kind="heading" className="h-l" />
      </header>
      <div className="faq-list">
        {list(b, "items").map((_, i) => {
          const on = editor ? true : open === i;
          return (
            <Reveal key={i} delay={i * 60} className={`faq-item${on ? " open" : ""}`}>
              <div className="faq-q">
                <T b={b} path={`items.${i}.q`} as="h3" />
                {!editor && <button type="button" aria-expanded={on} aria-label="Toggle answer" onClick={() => setOpen(on ? null : i)}><span aria-hidden="true">+</span></button>}
              </div>
              <div className="faq-a"><div><T b={b} path={`items.${i}.a`} as="p" /></div></div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

function Cta({ b }: { b: Block }) {
  return (
    <div className={`cta cta-${val(b, "variant")}`}>
      <T b={b} path="headline" as="h2" kind="heading" className="h-xl" />
      <T b={b} path="body" as="p" className="lede" delay={120} />
      <Reveal className="ctas" delay={220}><Btn b={b} label="ctaLabel" href="ctaHref" /></Reveal>
    </div>
  );
}

/** Stands in for the real course details in the editor. On the live site the course page renders the real ones between the template's sections. */
function CourseCore() {
  const { course, courses, editor } = useSite();
  if (!editor) return null;
  const c = course ?? courses[0];
  return (
    <div className="cc-ph">
      <small className="eyebrow">Course details</small>
      <h3>{c?.title ?? "Your course title"}</h3>
      <p>{c ? `${c.lessons.length} lessons · ₹${c.priceInr.toLocaleString("en-IN")}` : "Lessons, price and the reserve form"} appear here on every course page. This block stays in place; add your own sections above or below it.</p>
    </div>
  );
}

const REGISTRY: Record<string, (p: { b: Block }) => ReactNode> = {
  hero: Hero, marquee: Marquee, stats: Stats, statement: Statement, courses: Courses, features: Features,
  steps: Steps, live: Live, quotes: Quotes, about: About, faq: Faq, cta: Cta, custom: CustomSection, coursecore: CourseCore,
};

const ANCHORS: Record<string, string> = { courses: "courses", live: "live", quotes: "stories", about: "about", faq: "faq" };

/** One block, wrapped in the editor's frame when editing. */
export function BlockView({ block, index, anchor }: { block: Block; index: number; anchor?: string }) {
  const { editor } = useSite();
  const Inner = REGISTRY[block.type];
  if (!Inner) return null;
  if (block.hidden && !editor) return null;
  const custom = block.type === "custom";
  const className = `blk b-${block.type}${block.hidden ? " is-hidden" : ""}${custom ? ` ${sectionClasses(customOf(block.props))}` : ""}`;
  const body = (
    <>
      {custom && <CustomBg b={block} />}
      <div className="blk-in"><Inner b={block} /></div>
    </>
  );
  if (editor) {
    const Frame = editor.Frame;
    return <Frame block={block} index={index} className={className} anchor={anchor}>{body}</Frame>;
  }
  return (
    <section id={anchor} className={className} data-tone={block.tone ?? "base"}>
      {body}
    </section>
  );
}

/** The whole home page. The first block of each kind gets an anchor id (#courses, #live, …) for the nav. */
export function PageBlocks({ blocks }: { blocks: Block[] }) {
  const seen = new Set<string>();
  return (
    <>
      {blocks.map((b, i) => {
        const a = ANCHORS[b.type];
        const anchor = a && !seen.has(a) ? a : undefined;
        if (anchor) seen.add(anchor);
        return <BlockView key={b.id} block={b} index={i} anchor={anchor} />;
      })}
    </>
  );
}
