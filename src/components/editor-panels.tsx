"use client";

import { useState, type ReactNode } from "react";
import { BLOCKS, READY_MADE, TONES, type Field, type Leaf } from "@/lib/blocks";
import { TEMPLATES, type TemplateId } from "@/lib/templates";
import { ACCENTS, AMBIENTS, FONTS, LOOKS, MOTIONS, PRESETS, paletteOf, type FontKey, type PresetKey, type Theme } from "@/lib/theme";
import type { Block } from "@/lib/types";
import { ImageField } from "./media-library";
import { AiDraft } from "./ai-draft";
import { BuildYourOwn } from "./my-sections";
import type { CustomProps } from "@/lib/custom";

// The editor's side panels. The block inspector is generated from the same field declarations
// that the server validates against (lib/blocks.ts), so a new block type needs no new form code.

type Opt<T extends string> = { value: T; label: string };

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: readonly Opt<T>[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="tog">
      {label}
      <button className="switch" role="switch" aria-checked={on} aria-label={label} type="button" onClick={() => onChange(!on)} />
    </div>
  );
}

// ---------- block inspector ----------

function LeafInput({ f, value, onChange, id }: { f: Leaf; value: unknown; onChange: (v: unknown) => void; id: string }) {
  switch (f.kind) {
    case "text":
      return <input className="input" id={id} value={String(value ?? "")} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return <textarea className="input prose" id={id} rows={4} value={String(value ?? "")} maxLength={f.max} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return f.options.length <= 4 ? <Seg label={f.label} value={String(value)} options={f.options.map((o) => ({ value: o.value, label: o.label }))} onChange={onChange} /> : (
        <select className="input" id={id} value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "toggle":
      return <Switch on={value === true} onChange={onChange} label={f.label} />;
    case "link":
      return (
        <>
          <input className="input" id={id} list="link-targets" value={String(value ?? "")} placeholder="#courses, /login or https://…" onChange={(e) => onChange(e.target.value)} />
        </>
      );
    case "image":
      return <ImageField id={id} value={String(value ?? "")} onChange={onChange} />;
    case "date":
      return <input className="input" id={id} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <input className="input" id={id} type="number" min={f.min} max={f.max} value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} />;
  }
}

export function FieldRow({ f, value, onChange, id }: { f: Leaf; value: unknown; onChange: (v: unknown) => void; id: string }) {
  if (f.kind === "toggle") return <LeafInput f={f} value={value} onChange={onChange} id={id} />;
  return (
    <Row label={f.label} hint={f.hint}>
      <LeafInput f={f} value={value} onChange={onChange} id={id} />
    </Row>
  );
}

export function ListEditor({ f, items, onChange, idPrefix }: { f: Extract<Field, { kind: "list" }>; items: Record<string, unknown>[]; onChange: (items: Record<string, unknown>[]) => void; idPrefix: string }) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => onChange([...items, Object.fromEntries(f.fields.map((lf) => [lf.key, lf.default]))]);
  return (
    <div className="list-ed">
      <div className="list-h"><span>{f.label}</span><span className="mono muted">{items.length}/{f.max}</span></div>
      {items.map((item, i) => (
        <details key={i} className="list-item" open={items.length <= 2}>
          <summary>
            <span>{f.itemLabel} {i + 1}<em>{String(item[f.fields[0].key] ?? "").slice(0, 28)}</em></span>
            <span className="list-ops" onClick={(e) => e.preventDefault()}>
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, n) => n !== i))}>✕</button>
            </span>
          </summary>
          {f.fields.map((lf) => (
            <FieldRow key={lf.key} f={lf} id={`${idPrefix}-${i}-${lf.key}`} value={item[lf.key]} onChange={(v) => onChange(items.map((it, n) => (n === i ? { ...it, [lf.key]: v } : it)))} />
          ))}
        </details>
      ))}
      {items.length < f.max && <button type="button" className="btn sm" onClick={add}>+ Add {f.itemLabel.toLowerCase()}</button>}
    </div>
  );
}

export function BlockInspector({ block, onProp, onTone, onDuplicate, onRemove, onToggleHidden }: { block: Block; onProp: (path: string, value: unknown) => void; onTone: (tone: string) => void; onDuplicate: () => void; onRemove: () => void; onToggleHidden: () => void }) {
  const def = BLOCKS[block.type];
  return (
    <div className="insp">
      <div className="insp-head">
        <span className="insp-ico">{def.icon}</span>
        <div><b>{def.label}</b><span>{def.blurb}</span></div>
      </div>
      <div className="insp-actions">
        <button className="btn sm" type="button" onClick={onDuplicate}>Duplicate</button>
        <button className="btn sm" type="button" onClick={onToggleHidden}>{block.hidden ? "Show" : "Hide"}</button>
        <button className="btn sm danger" type="button" onClick={onRemove}>Delete</button>
      </div>
      <Row label="Section colour" hint="Alternate tones to give the page rhythm.">
        <Seg label="Tone" value={block.tone ?? def.tone} options={TONES} onChange={onTone} />
      </Row>
      {def.fields.map((f) =>
        f.kind === "list" ? (
          <ListEditor key={f.key} f={f} idPrefix={`${block.id}-${f.key}`} items={(block.props[f.key] as Record<string, unknown>[]) ?? []} onChange={(items) => onProp(f.key, items)} />
        ) : (
          <FieldRow key={f.key} f={f} id={`${block.id}-${f.key}`} value={block.props[f.key]} onChange={(v) => onProp(f.key, v)} />
        ),
      )}
      <p className="hint">Tip: click any text on the page to edit it in place. Select words and press ⌘I (Ctrl+I) to set them in the accent serif.</p>
    </div>
  );
}

// ---------- design ----------

export function ColorDot({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  return (
    <label className="cdot" title={label}>
      <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      <span style={{ background: value }} />
      <small>{label}</small>
    </label>
  );
}

export function DesignPanel({ theme, onTheme }: { theme: Theme; onTheme: (patch: Partial<Theme>, key?: string) => void }) {
  const pal = paletteOf(theme);
  const customised = !!theme.custom && Object.keys(theme.custom).length > 0;
  const setPal = (k: "bg" | "surface" | "ink" | "muted", v: string) => onTheme({ custom: { ...theme.custom, [k]: v } }, `pal:${k}`);
  return (
    <div className="insp">
      <section className="dsec">
        <h4>Looks <span>one-click moods</span></h4>
        <div className="looks">
          {Object.entries(LOOKS).map(([id, l]) => {
            const p = PRESETS[l.theme.preset as PresetKey];
            return (
              <button key={id} type="button" className="look" onClick={() => onTheme({ ...l.theme, custom: undefined })} style={{ background: p.bg, color: p.ink }}>
                <i style={{ background: l.theme.accent }} />
                <b style={{ fontFamily: FONTS[l.theme.font as FontKey].display }}>{l.name}</b>
                <small style={{ color: p.muted }}>{l.blurb}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="dsec">
        <h4>Colour <span>{PRESETS[theme.preset].name}{customised ? " · edited" : ""}</span></h4>
        <div className="presets">
          {(Object.keys(PRESETS) as PresetKey[]).map((k) => {
            const p = PRESETS[k];
            return (
              <button key={k} className="preset" type="button" aria-pressed={theme.preset === k} onClick={() => onTheme({ preset: k, custom: undefined, accent: p.accent })}>
                <span className="sw"><i style={{ background: p.bg }} /><i style={{ background: p.surface }} /><i style={{ background: p.accent }} /></span>
                {p.name}
              </button>
            );
          })}
        </div>
        <div className="cdots">
          <ColorDot label="Page" value={pal.bg} onChange={(v) => setPal("bg", v)} />
          <ColorDot label="Soft" value={pal.surface} onChange={(v) => setPal("surface", v)} />
          <ColorDot label="Text" value={pal.ink} onChange={(v) => setPal("ink", v)} />
          <ColorDot label="Muted" value={pal.muted} onChange={(v) => setPal("muted", v)} />
          {customised && <button className="btn sm" type="button" onClick={() => onTheme({ custom: undefined })}>Reset</button>}
        </div>
      </section>

      <section className="dsec">
        <h4>Accent <span>{theme.accent}</span></h4>
        <div className="swatches">
          {ACCENTS.map((c) => <button key={c} type="button" style={{ background: c }} aria-label={`Accent ${c}`} aria-pressed={theme.accent === c} onClick={() => onTheme({ accent: c })} />)}
          <input type="color" aria-label="Custom accent" value={theme.accent} onChange={(e) => onTheme({ accent: e.target.value }, "accent")} />
        </div>
        <div className="row2">
          <span className="muted">Second accent (3D scenes, gradients)</span>
          <div className="swatches">
            <button type="button" className="auto" aria-pressed={!theme.accent2} onClick={() => onTheme({ accent2: undefined })} aria-label="Automatic second accent">A</button>
            {ACCENTS.slice(0, 8).map((c) => <button key={c} type="button" style={{ background: c }} aria-label={`Second accent ${c}`} aria-pressed={theme.accent2 === c} onClick={() => onTheme({ accent2: c })} />)}
            <input type="color" aria-label="Custom second accent" value={theme.accent2 ?? theme.accent} onChange={(e) => onTheme({ accent2: e.target.value }, "accent2")} />
          </div>
        </div>
      </section>

      <section className="dsec">
        <h4>Typography</h4>
        <div className="fonts">
          {(Object.keys(FONTS) as FontKey[]).map((k) => (
            <button key={k} type="button" aria-pressed={theme.font === k} onClick={() => onTheme({ font: k })}>
              <b style={{ fontFamily: FONTS[k].display, fontWeight: FONTS[k].weight, letterSpacing: FONTS[k].tracking }}>Aa <i style={{ fontFamily: FONTS[k].serif }}>Bb</i></b>
              <small>{FONTS[k].label}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="dsec">
        <h4>Shape <span className="num">{theme.radius}px</span></h4>
        <input type="range" min={0} max={40} value={theme.radius} aria-label="Corner radius" onChange={(e) => onTheme({ radius: Number(e.target.value) }, "radius")} />
      </section>

      <section className="dsec">
        <h4>Motion</h4>
        <Seg label="Motion" value={theme.motion} options={MOTIONS.map((m) => ({ value: m, label: { off: "Still", calm: "Calm", rich: "Rich" }[m] }))} onChange={(motion) => onTheme({ motion })} />
        <span className="hint">Calm fades text in. Rich adds blur reveals, magnetic buttons and a drifting 3D arc. Visitors who prefer reduced motion always get a still page.</span>
      </section>

      <section className="dsec">
        <h4>Backdrop</h4>
        <Seg label="Backdrop" value={theme.ambient} options={AMBIENTS.map((a) => ({ value: a, label: { none: "Plain", aurora: "Aurora", grid: "Grid" }[a] }))} onChange={(ambient) => onTheme({ ambient })} />
        <Switch on={theme.grain} onChange={(grain) => onTheme({ grain })} label="Film grain" />
        <Switch on={theme.glow} onChange={(glow) => onTheme({ glow })} label="Cursor glow on cards" />
      </section>

      <section className="dsec">
        <h4>Language</h4>
        <Seg label="Language" value={theme.lang} options={[{ value: "en", label: "English" }, { value: "hi", label: "हिन्दी" }]} onChange={(lang) => onTheme({ lang })} />
      </section>
    </div>
  );
}

// ---------- add ----------

export function AddPanel({ where, slug, canTemplate, ai, savedTick, onAdd, onAddCustom, onTemplate }: { where: string; slug: string; canTemplate: boolean; ai?: (description: string, language: "en" | "hi") => Promise<string | null>; savedTick: number; onAdd: (type: string) => void; onAddCustom: (props: CustomProps) => void; onTemplate: (id: TemplateId, withLook: boolean) => void }) {
  const [confirm, setConfirm] = useState<TemplateId | null>(null);
  return (
    <div className="insp">
      <p className="hint add-where">{where}</p>
      {ai && <AiDraft onGenerate={ai} />}
      <BuildYourOwn slug={slug} onAdd={onAddCustom} refreshKey={savedTick} />
      <section className="dsec"><h4>Ready-made sections <span>fill in the blanks</span></h4></section>
      <div className="lib">
        {READY_MADE.map((type) => (
          <button key={type} type="button" className="lib-card" onClick={() => onAdd(type)}>
            <span className="lib-ico">{BLOCKS[type].icon}</span>
            <b>{BLOCKS[type].label}</b>
            <small>{BLOCKS[type].blurb}</small>
          </button>
        ))}
      </div>
      {canTemplate && (
      <section className="dsec">
        <h4>Start from a template <span>replaces the page</span></h4>
        <div className="tpls">
          {TEMPLATES.map((tp) => (
            <div key={tp.id} className="tpl">
              <div><b>{tp.name}</b><small>{tp.who}</small></div>
              {confirm === tp.id ? (
                <span className="tpl-ask">
                  <button type="button" className="btn sm danger" onClick={() => { onTemplate(tp.id, false); setConfirm(null); }}>Layout</button>
                  <button type="button" className="btn sm danger" onClick={() => { onTemplate(tp.id, true); setConfirm(null); }}>Layout + look</button>
                  <button type="button" className="btn sm" onClick={() => setConfirm(null)}>Cancel</button>
                </span>
              ) : (
                <button type="button" className="btn sm" onClick={() => setConfirm(tp.id)}>Use</button>
              )}
            </div>
          ))}
        </div>
        <span className="hint">You can undo a template with ⌘Z.</span>
      </section>
      )}
    </div>
  );
}
