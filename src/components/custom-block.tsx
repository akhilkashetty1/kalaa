"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ELEMENTS, allowedEmbed, countdownTarget, customOf, whatsappLink, type El } from "@/lib/custom";
import { inr } from "@/lib/i18n";
import { embedFor } from "@/lib/lessons";
import type { Block } from "@/lib/types";
import { Editable } from "./editable";
import { LeadForm } from "./lead-form";
import { CountUp, Magnetic, Reveal, Rich, Words } from "./motion";
import { useSite } from "./site-context";

// Renders a custom section: a row of columns, each a stack of elements. The same code draws the live
// site and the editor canvas. On the live site text is animated and links work; in the editor text is
// click-to-edit, links are inert, embedded frames don't steal clicks, and clicking an element selects it.
// Everything shown comes from validated data (lib/custom.ts); nothing here injects markup.

const maxOf = (type: El["type"], key: string) => {
  const f = ELEMENTS[type].fields.find((x) => x.key === key);
  return f && "max" in f ? f.max : 200;
};

/** Text that is click-to-edit in the editor and animated on the live site. */
function Txt({ b, path, value, as = "p", className = "", max, multiline = false, kind = "plain", placeholder = "Type here" }: { b: Block; path: string; value: string; as?: "p" | "h2" | "h3" | "h4" | "span" | "li" | "div"; className?: string; max: number; multiline?: boolean; kind?: "plain" | "heading"; placeholder?: string }) {
  const { editor } = useSite();
  if (editor) return <Editable blockId={b.id} path={path} value={value} as={as} className={className} multiline={multiline} max={max} placeholder={placeholder} />;
  if (!value) return null;
  if (kind === "heading") {
    return (
      <Reveal as={as} variant="words" className={className}>
        <Words text={value} />
      </Reveal>
    );
  }
  const paragraphs = value.split(/\n{2,}/);
  if (paragraphs.length > 1 && as === "p") {
    return (
      <div className={`cs-paras ${className}`}>
        {paragraphs.map((para, i) => (
          <Reveal key={i} as="p" delay={i * 60}>
            <Lines text={para} />
          </Reveal>
        ))}
      </div>
    );
  }
  return (
    <Reveal as={as} className={className}>
      <Lines text={value} />
    </Reveal>
  );
}

/** Rich text with single line breaks kept. */
function Lines({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          <Rich text={line} />
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

function Placeholder({ children }: { children: ReactNode }) {
  return <div className="cs-empty-el">{children}</div>;
}

function Countdown({ date, time, label, done, b, path }: { date: string; time: string; label: string; done: string; b: Block; path: (k: string) => string }) {
  const target = countdownTarget(date, time);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = now === null ? null : Math.max(0, target - now);
  const finished = left !== null && left === 0;
  const parts: [string, number | null][] = [
    ["days", left === null ? null : Math.floor(left / 86_400_000)],
    ["hours", left === null ? null : Math.floor(left / 3_600_000) % 24],
    ["mins", left === null ? null : Math.floor(left / 60_000) % 60],
    ["secs", left === null ? null : Math.floor(left / 1000) % 60],
  ];
  return (
    <div className="cs-countdown">
      <Txt b={b} path={path("label")} value={label} as="p" className="eyebrow" max={80} placeholder="Text above" />
      {finished ? (
        <Txt b={b} path={path("done")} value={done} as="p" className="cs-cd-done" max={80} placeholder="Text when it's over" />
      ) : (
        <div className="cs-cd" role="timer" aria-label={`${label}: ${parts.map(([u, v]) => `${v ?? 0} ${u}`).join(", ")}`}>
          {parts.map(([unit, v]) => (
            <div key={unit}>
              <b>{v === null ? "--" : String(v).padStart(2, "0")}</b>
              <small>{unit}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const seatsText = (n: number) => (n === 0 ? "Full" : `${n} seat${n === 1 ? "" : "s"} left`);

/** Cards for the site's published courses. Real data: titles, prices and seats left come from the database. */
function CourseCards({ p }: { p: Record<string, unknown> }) {
  const { courses, editor } = useSite();
  const tag = str(p.tag).trim().toLowerCase();
  const limit = Math.min(12, Math.max(1, Number(p.limit) || 3));
  const list = courses.filter((c) => !tag || c.tag?.toLowerCase() === tag).slice(0, limit);
  if (!list.length) return editor ? <Placeholder>{tag ? `No published course has the badge “${str(p.tag)}”.` : "Your published courses appear here."}</Placeholder> : null;
  return (
    <div className="cs-cards">
      {list.map((c) => (
        <a key={c.id} className="cs-card" href={`/courses/${c.slug}`} onClick={(e) => editor && e.preventDefault()}>
          {c.tag && <span className="cs-card-tag">{c.tag}</span>}
          <b>{c.title}</b>
          {c.summary && <p>{c.summary}</p>}
          <span className="cs-card-foot">
            {p.price !== false && (
              <span className="cs-price">
                {inr(c.priceInr)}
                {c.mrpInr && c.mrpInr > c.priceInr && <s>{inr(c.mrpInr)}</s>}
              </span>
            )}
            {p.seats !== false && c.seatsLeft !== undefined && <span className={`cs-seats${c.seatsLeft === 0 ? " full" : ""}`}>{seatsText(c.seatsLeft)}</span>}
          </span>
        </a>
      ))}
    </div>
  );
}

/** Price, seats, lessons and hours of one course: the current one on a course page, else the first in the editor. */
function CourseFacts({ p }: { p: Record<string, unknown> }) {
  const { course, courses, editor } = useSite();
  const c = course ?? (editor ? courses[0] : null);
  if (!c) return editor ? <Placeholder>Course facts appear here once you have a published course.</Placeholder> : null;
  const minutes = c.lessons.reduce((n, l) => n + l.minutes, 0);
  const chips: string[] = [];
  if (p.price !== false) chips.push(`${inr(c.priceInr)}${c.mrpInr && c.mrpInr > c.priceInr ? ` (was ${inr(c.mrpInr)})` : ""}`);
  if (p.seats !== false && c.seatsLeft !== undefined) chips.push(seatsText(c.seatsLeft));
  if (p.lessons !== false) chips.push(`${c.lessons.length} lesson${c.lessons.length === 1 ? "" : "s"}`);
  if (p.hours !== false && minutes > 0) chips.push(`${Math.round(minutes / 6) / 10} h of video`);
  return (
    <ul className="cs-facts">
      {chips.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );
}

/** One number from the site's data. Zero is never shown to visitors: it would only say "nobody yet". */
function Statistic({ p }: { p: Record<string, unknown> }) {
  const { facts, editor } = useSite();
  const kind = (["students", "courses", "lessons", "hours"] as const).find((k) => k === p.kind) ?? "students";
  const value = facts[kind];
  if (!value && !editor) return null;
  return (
    <div className="cs-stat">
      <b className="num">{value ? <CountUp value={`${value.toLocaleString("en-IN")}${str(p.suffix)}`} /> : "0"}</b>
      <span>{str(p.label)}</span>
      {!value && editor && <small className="cs-stat-hint">Visitors won&apos;t see this until it is above zero.</small>}
    </div>
  );
}

function Element({ b, el, ci, ei }: { b: Block; el: El; ci: number; ei: number }) {
  const { editor } = useSite();
  const path = (k: string) => `cols.${ci}.${ei}.props.${k}`;
  const p = el.props;
  const inert = (e: React.MouseEvent) => editor && e.preventDefault();

  switch (el.type) {
    case "heading":
      return <Txt b={b} path={path("text")} value={str(p.text)} as="h2" kind="heading" className={`cs-h cs-h-${str(p.size) || "l"}`} max={maxOf("heading", "text")} placeholder="Heading" />;

    case "text":
      return <Txt b={b} path={path("text")} value={str(p.text)} as="p" multiline className={`cs-text cs-t-${str(p.size) || "m"} cs-c-${str(p.color) || "muted"}`} max={maxOf("text", "text")} placeholder="Write something" />;

    case "image": {
      const src = str(p.src);
      if (!src) return editor ? <Placeholder>Choose an image in the panel on the right</Placeholder> : null;
      const img = (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={`cs-img cs-r-${(str(p.ratio) || "auto").replace(":", "")} cs-f-${str(p.fit) || "cover"}${p.round === false ? "" : " cs-round"}`} src={src} alt={str(p.alt)} loading="lazy" referrerPolicy="no-referrer" />
      );
      const href = str(p.href);
      return href ? (
        <a href={href} onClick={inert} className="cs-imglink" {...(href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{img}</a>
      ) : img;
    }

    case "button": {
      const label = str(p.label);
      const href = str(p.href) || "#";
      const cls = `bbtn${p.style === "ghost" ? " ghost" : ""}`;
      if (editor) {
        return (
          <a className={cls} href={href} onClick={inert}>
            <Editable blockId={b.id} path={path("label")} value={label} as="span" max={30} placeholder="Button" />
          </a>
        );
      }
      if (!label) return null;
      return (
        <Magnetic>
          <a className={cls} href={href} {...(href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{label}</a>
        </Magnetic>
      );
    }

    case "video": {
      const embed = str(p.url) ? embedFor(str(p.url)) : null;
      if (!embed) return editor ? <Placeholder>Paste a YouTube or Vimeo link in the panel on the right</Placeholder> : null;
      return (
        <div className="cs-frame cs-video">
          <iframe src={embed} title={str(p.title) || "Video"} loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
        </div>
      );
    }

    case "embed": {
      const url = allowedEmbed(str(p.url));
      if (!url) return editor ? <Placeholder>Add a Google Map, Form, Calendly or Tally address in the panel on the right</Placeholder> : null;
      const height = Math.min(900, Math.max(200, Number(p.height) || 420));
      return (
        <div className="cs-frame" style={{ height }}>
          <iframe src={url} title={str(p.title) || "Embedded content"} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" />
        </div>
      );
    }

    case "list": {
      const items = (Array.isArray(p.items) ? p.items : []) as { text?: string }[];
      const Tag = p.style === "numbers" ? "ol" : "ul";
      return (
        <Tag className={`cs-list cs-li-${str(p.style) || "checks"}`}>
          {items.map((it, i) => (
            <li key={i}>
              <Txt b={b} path={path(`items.${i}.text`)} value={str(it.text)} as="span" max={140} placeholder="Item" />
            </li>
          ))}
        </Tag>
      );
    }

    case "divider":
      return <hr className={`cs-hr cs-hr-${str(p.style) || "line"}`} />;

    case "spacer":
      return <div className={`cs-space cs-s-${str(p.size) || "m"}`} aria-hidden="true" />;

    case "countdown":
      return <Countdown b={b} date={str(p.date)} time={str(p.time)} label={str(p.label)} done={str(p.done)} path={path} />;

    case "iconbox":
      return (
        <div className="cs-iconbox">
          <span className="cs-ico" aria-hidden="true">{str(p.icon) || "✦"}</span>
          <Txt b={b} path={path("title")} value={str(p.title)} as="h3" className="cs-ib-title" max={80} placeholder="Title" />
          <Txt b={b} path={path("text")} value={str(p.text)} as="p" multiline className="cs-ib-text" max={240} placeholder="A line of text" />
        </div>
      );

    case "form":
      return <LeadForm b={b} el={el} labelPath={path("button")} />;

    case "courses":
      return <CourseCards p={p} />;

    case "coursefacts":
      return <CourseFacts p={p} />;

    case "statistic":
      return <Statistic p={p} />;

    case "whatsapp": {
      const number = str(p.number);
      const label = str(p.label) || "Chat on WhatsApp";
      if (!number) return editor ? <Placeholder>Add your WhatsApp number in the panel on the right</Placeholder> : null;
      const href = whatsappLink(number, str(p.message));
      if (editor) {
        return (
          <a className="bbtn cs-wa" href={href} onClick={inert}>
            <Editable blockId={b.id} path={path("label")} value={label} as="span" max={30} placeholder="Button" />
          </a>
        );
      }
      return (
        <Magnetic>
          <a className="bbtn cs-wa" href={href} target="_blank" rel="noopener noreferrer">{label}</a>
        </Magnetic>
      );
    }
  }
}

/** The section's coloured, gradient or picture background, drawn edge to edge behind the content. */
export function CustomBg({ b }: { b: Block }) {
  const { bg } = customOf(b.props).design;
  if (bg.kind === "none") return null;
  if (bg.kind === "color") return <div className="cs-bg" aria-hidden="true" style={{ background: bg.color }} />;
  if (bg.kind === "gradient") return <div className="cs-bg" aria-hidden="true" style={{ background: `linear-gradient(${bg.angle}deg, ${bg.color}, ${bg.color2})` }} />;
  if (!bg.image) return null;
  return (
    <div className="cs-bg" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bg.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
      <div className="cs-shade" style={{ opacity: bg.overlay / 100 }} />
    </div>
  );
}

export function CustomSection({ b }: { b: Block }) {
  const { editor } = useSite();
  const p = customOf(b.props);
  const empty = p.cols.every((c) => c.length === 0);
  return (
    <div className={`cs-grid cs-l-${p.layout}`}>
      {p.cols.map((col, ci) => (
        <div className="cs-col" key={ci}>
          {col.map((el, ei) => (
            <div
              key={el.id}
              className={`cs-el cs-el-${el.type}${editor?.selectedElId === el.id ? " is-sel" : ""}`}
              {...(editor ? { onClick: () => editor.selectEl(b.id, el.id), "data-elid": el.id } : {})}
            >
              <Element b={b} el={el} ci={ci} ei={ei} />
            </div>
          ))}
          {editor && col.length === 0 && !empty && <div className="cs-empty-col">Empty column</div>}
        </div>
      ))}
      {editor && empty && <div className="cs-empty-sec" style={{ gridColumn: "1 / -1" } as CSSProperties}>An empty section. Add elements from the panel on the right.</div>}
    </div>
  );
}
