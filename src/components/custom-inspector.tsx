"use client";

import { useState, type ReactNode } from "react";
import { TONES } from "@/lib/blocks";
import { ELEMENTS, ELEMENT_TYPES, LAYOUTS, MAX_PER_COLUMN, MAX_PER_SECTION, addEl, columnWeights, countElements, customOf, duplicateEl, firstText, locate, moveEl, newEl, removeEl, setDesign, setElProp, withLayout, type CustomProps, type ElementType, type LayoutKey } from "@/lib/custom";
import type { Block } from "@/lib/types";
import { ColorDot, FieldRow, ListEditor, Row, Seg, Switch } from "./editor-panels";
import { ImageField } from "./media-library";

// The inspector for a custom section. Four parts, top to bottom: the layout (how many columns), the
// content (the elements in each column, with the selected one's fields below), the design (width,
// spacing, background, text colour) and per-device visibility. Every change is a pure function from
// lib/custom.ts applied to the section, so undo, redo and publish work like everywhere else.

type Change = (fn: (p: CustomProps) => CustomProps, key?: string) => void;

type Props = {
  block: Block;
  selectedElId: string | null;
  onChange: Change;
  onSelectEl: (id: string | null) => void;
  onTone: (tone: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onToggleHidden: () => void;
  /** Saves a copy of the section to the site's library. Resolves to an error message, or null on success. */
  onSaveSection: (name: string) => Promise<string | null>;
};

function Group({ title, note, children, open = true }: { title: string; note?: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="dsec site-sec" open={open}>
      <summary><h4>{title} {note && <span>{note}</span>}</h4></summary>
      <div className="site-sec-body">{children}</div>
    </details>
  );
}

/** A tiny drawing of a layout: one bar per column, as wide as the column. */
function LayoutPicker({ value, onPick }: { value: LayoutKey; onPick: (l: LayoutKey) => void }) {
  return (
    <div className="layouts" role="group" aria-label="Columns">
      {LAYOUTS.map((l) => (
        <button key={l.key} type="button" className="layout" aria-pressed={value === l.key} onClick={() => onPick(l.key)} title={l.label} aria-label={l.label}>
          {columnWeights(l.key).map((w, i) => <i key={i} style={{ flex: w }} />)}
        </button>
      ))}
    </div>
  );
}

function ElementPicker({ onPick, disabled }: { onPick: (t: ElementType) => void; disabled: boolean }) {
  return (
    <div className="elpick">
      {ELEMENT_TYPES.map((t) => (
        <button key={t} type="button" className="lib-card" disabled={disabled} onClick={() => onPick(t)} title={ELEMENTS[t].blurb}>
          <span className="lib-ico">{ELEMENTS[t].icon}</span>
          <b>{ELEMENTS[t].label}</b>
        </button>
      ))}
    </div>
  );
}

const gistOf = (e: CustomProps["cols"][number][number]) => {
  const v = e.props.text ?? e.props.title ?? e.props.label ?? e.props.url ?? e.props.src ?? "";
  return typeof v === "string" ? v.replace(/\*/g, "").replace(/^https?:\/\//, "").slice(0, 26) : "";
};

export function CustomInspector({ block, selectedElId, onChange, onSelectEl, onTone, onDuplicate, onRemove, onToggleHidden, onSaveSection }: Props) {
  const p = customOf(block.props);
  const d = p.design;
  const [adding, setAdding] = useState<number | null>(null);
  const [saving, setSaving] = useState<null | { name: string; busy: boolean; msg: string }>(null);
  const selected = selectedElId ? locate(p, selectedElId) : null;
  const total = countElements(p);
  const design = (patch: Parameters<typeof setDesign>[1], key?: string) => onChange((x) => setDesign(x, patch), key ? `design:${key}` : undefined);

  return (
    <div className="insp">
      <div className="insp-head">
        <span className="insp-ico">▦</span>
        <div><b>Custom section</b><span>Columns of text, images, buttons and more.</span></div>
      </div>
      <div className="insp-actions">
        <button className="btn sm" type="button" onClick={onDuplicate}>Duplicate</button>
        <button className="btn sm" type="button" onClick={onToggleHidden}>{block.hidden ? "Show" : "Hide"}</button>
        <button className="btn sm" type="button" onClick={() => setSaving(saving ? null : { name: firstText(p), busy: false, msg: "" })}>Save as my section</button>
        <button className="btn sm danger" type="button" onClick={onRemove}>Delete</button>
      </div>

      {saving && (
        <form
          className="savebox"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving({ ...saving, busy: true, msg: "" });
            const err = await onSaveSection(saving.name);
            setSaving(err ? { ...saving, busy: false, msg: err } : null);
          }}
        >
          <label htmlFor="save-name">Name for this section</label>
          <input id="save-name" className="input" value={saving.name} maxLength={40} autoFocus placeholder="Course highlights" onChange={(e) => setSaving({ ...saving, name: e.target.value, msg: "" })} />
          <span className="hint">Saved to “Add → My sections”. You can insert a copy on any page.</span>
          {saving.msg && <span className="media-err" role="alert">{saving.msg}</span>}
          <span className="insp-actions">
            <button className="btn sm gold" type="submit" disabled={saving.busy || !saving.name.trim()}>{saving.busy ? "Saving…" : "Save"}</button>
            <button className="btn sm" type="button" onClick={() => setSaving(null)}>Cancel</button>
          </span>
        </form>
      )}

      <Group title="Layout" note="columns">
        <LayoutPicker value={p.layout} onPick={(l) => onChange((x) => withLayout(x, l))} />
        {p.cols.length > 1 && <Switch on={d.reverse} onChange={(v) => design({ reverse: v })} label="Last column first on phones" />}
      </Group>

      <Group title="Content" note={`${total}/${MAX_PER_SECTION} elements`}>
        {p.cols.map((col, ci) => (
          <div className="colgroup" key={ci}>
            {p.cols.length > 1 && <div className="colgroup-h">Column {ci + 1}</div>}
            {col.length === 0 && <p className="hint">Empty. Add an element below.</p>}
            <ul className="elrows">
              {col.map((e, ei) => (
                <li key={e.id} className={`elrow${selectedElId === e.id ? " sel" : ""}`}>
                  <button type="button" className="elrow-main" onClick={() => onSelectEl(selectedElId === e.id ? null : e.id)}>
                    <span className="lib-ico">{ELEMENTS[e.type].icon}</span>
                    <span><b>{ELEMENTS[e.type].label}</b><small>{gistOf(e) || "—"}</small></span>
                  </button>
                  <span className="list-ops">
                    <button type="button" aria-label="Move up" disabled={ei === 0} onClick={() => onChange((x) => moveEl(x, e.id, { dir: -1 }))}>↑</button>
                    <button type="button" aria-label="Move down" disabled={ei === col.length - 1} onClick={() => onChange((x) => moveEl(x, e.id, { dir: 1 }))}>↓</button>
                    <button type="button" aria-label="Duplicate element" disabled={col.length >= MAX_PER_COLUMN || total >= MAX_PER_SECTION} onClick={() => { const r = duplicateEl(p, e.id); onChange(() => r.props); if (r.id) onSelectEl(r.id); }}>⧉</button>
                    <button type="button" aria-label="Delete element" onClick={() => { onChange((x) => removeEl(x, e.id)); if (selectedElId === e.id) onSelectEl(null); }}>✕</button>
                  </span>
                </li>
              ))}
            </ul>
            {adding === ci ? (
              <>
                <ElementPicker disabled={col.length >= MAX_PER_COLUMN || total >= MAX_PER_SECTION} onPick={(t) => { const el = newEl(t); onChange((x) => addEl(x, ci, el)); onSelectEl(el.id); setAdding(null); }} />
                <button type="button" className="btn sm" onClick={() => setAdding(null)}>Cancel</button>
              </>
            ) : (
              <button type="button" className="btn sm" disabled={col.length >= MAX_PER_COLUMN || total >= MAX_PER_SECTION} onClick={() => setAdding(ci)}>+ Add element{p.cols.length > 1 ? ` to column ${ci + 1}` : ""}</button>
            )}
          </div>
        ))}

        {selected && (
          <div className="elform">
            <div className="elform-h">
              <b>{ELEMENTS[selected.el.type].label}</b>
              {p.cols.length > 1 && (
                <label className="elform-move">
                  Column
                  <select className="input" value={selected.col} onChange={(e) => onChange((x) => moveEl(x, selected.el.id, { col: Number(e.target.value) }))} aria-label="Move to column">
                    {p.cols.map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
                  </select>
                </label>
              )}
            </div>
            {ELEMENTS[selected.el.type].fields.map((f) =>
              f.kind === "list" ? (
                <ListEditor key={`${selected.el.id}-${f.key}`} f={f} idPrefix={`${selected.el.id}-${f.key}`} items={(selected.el.props[f.key] as Record<string, unknown>[]) ?? []} onChange={(items) => onChange((x) => setElProp(x, selected.el.id, f.key, items), `${selected.el.id}:${f.key}`)} />
              ) : (
                <FieldRow key={`${selected.el.id}-${f.key}`} f={f} id={`${selected.el.id}-${f.key}`} value={selected.el.props[f.key]} onChange={(v) => onChange((x) => setElProp(x, selected.el.id, f.key, v), `${selected.el.id}:${f.key}`)} />
              ),
            )}
          </div>
        )}
        {!selected && total > 0 && <p className="hint">Click an element, here or on the page, to edit its options. Text can be edited right on the page.</p>}
      </Group>

      <Group title="Design" note="size, spacing, background">
        <Row label="Width">
          <Seg label="Width" value={d.width} options={[{ value: "narrow", label: "Narrow" }, { value: "contained", label: "Page" }, { value: "wide", label: "Wide" }, { value: "full", label: "Full" }]} onChange={(v) => design({ width: v })} />
        </Row>
        <Row label="Space above and below">
          <Seg label="Spacing" value={d.pad} options={[{ value: "none", label: "None" }, { value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }, { value: "xl", label: "XL" }]} onChange={(v) => design({ pad: v })} />
        </Row>
        <Row label="Space between things">
          <Seg label="Gap" value={d.gap} options={[{ value: "sm", label: "Tight" }, { value: "md", label: "Normal" }, { value: "lg", label: "Airy" }]} onChange={(v) => design({ gap: v })} />
        </Row>
        <Row label="Align content">
          <Seg label="Alignment" value={d.align} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }]} onChange={(v) => design({ align: v })} />
        </Row>
        {p.cols.length > 1 && (
          <Row label="Line up columns">
            <Seg label="Vertical alignment" value={d.valign} options={[{ value: "top", label: "Top" }, { value: "center", label: "Middle" }, { value: "bottom", label: "Bottom" }]} onChange={(v) => design({ valign: v })} />
          </Row>
        )}
        <Row label="Background">
          <Seg label="Background" value={d.bg.kind} options={[{ value: "none", label: "None" }, { value: "color", label: "Colour" }, { value: "gradient", label: "Gradient" }, { value: "image", label: "Image" }]} onChange={(v) => design({ bg: { kind: v } })} />
        </Row>
        {d.bg.kind === "none" && (
          <Row label="Section colour" hint="Alternate tones to give the page rhythm.">
            <Seg label="Tone" value={block.tone ?? "base"} options={TONES} onChange={onTone} />
          </Row>
        )}
        {(d.bg.kind === "color" || d.bg.kind === "gradient") && (
          <div className="cdots">
            <ColorDot label={d.bg.kind === "gradient" ? "From" : "Colour"} value={d.bg.color} onChange={(v) => design({ bg: { color: v } }, "bgc")} />
            {d.bg.kind === "gradient" && <ColorDot label="To" value={d.bg.color2} onChange={(v) => design({ bg: { color2: v } }, "bgc2")} />}
          </div>
        )}
        {d.bg.kind === "gradient" && (
          <Row label={`Angle · ${d.bg.angle}°`}>
            <input type="range" min={0} max={360} step={5} value={d.bg.angle} aria-label="Gradient angle" onChange={(e) => design({ bg: { angle: Number(e.target.value) } }, "bga")} />
          </Row>
        )}
        {d.bg.kind === "image" && (
          <>
            <Row label="Picture" hint="Wide images look best. They fill the whole section.">
              <ImageField id={`${block.id}-bgimg`} value={d.bg.image} onChange={(v) => design({ bg: { image: v } })} />
            </Row>
            <Row label={`Darken · ${d.bg.overlay}%`} hint="A dark layer over the picture keeps text readable.">
              <input type="range" min={0} max={85} step={5} value={d.bg.overlay} aria-label="Darken picture" onChange={(e) => design({ bg: { overlay: Number(e.target.value) } }, "bgo")} />
            </Row>
          </>
        )}
        {d.bg.kind !== "none" && (
          <Row label="Text colour" hint="Auto picks light or dark text to match the background.">
            <Seg label="Text colour" value={d.text} options={[{ value: "auto", label: "Auto" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} onChange={(v) => design({ text: v })} />
          </Row>
        )}
      </Group>

      <Group title="Visibility" note="per device" open={false}>
        <Switch on={d.hideMobile} onChange={(v) => design({ hideMobile: v })} label="Hide on phones" />
        <Switch on={d.hideDesktop} onChange={(v) => design({ hideDesktop: v })} label="Hide on tablets and computers" />
        <p className="hint">Hidden sections stay visible, faded, in the editor so you can still change them.</p>
      </Group>
    </div>
  );
}
