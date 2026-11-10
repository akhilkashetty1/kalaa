"use client";

import { useState } from "react";
import { AI_LIMITS } from "@/lib/ai-copy";
import { Seg } from "./editor-panels";

// "Write my page with AI": the teacher describes their teaching and gets a first draft of the words on
// their home page. Only copy is written (headline, intro, about, why-us, questions, call to action) into the
// sections they already have; layout and everything else stay. It lands as an unpublished draft, ⌘Z undoes it.

export function AiDraft({ onGenerate }: { onGenerate: (description: string, language: "en" | "hi") => Promise<string | null> }) {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const enough = text.trim().length >= AI_LIMITS.minDescription;

  return (
    <section className="dsec">
      <h4>Write my page with AI <span>a first draft</span></h4>
      <p className="hint">Describe what you teach, who it&apos;s for and what makes your classes different. We&apos;ll rewrite your headline, intro, about, “why us”, questions and button. Your layout stays.</p>
      <textarea
        className="input prose"
        rows={5}
        value={text}
        maxLength={AI_LIMITS.description}
        placeholder="I teach JEE and NEET physics to class 11 and 12 students. I start from the idea, not the formula, and run live doubt sessions every week…"
        aria-label="Describe your teaching"
        onChange={(e) => { setText(e.target.value); setError(""); }}
        disabled={busy}
      />
      <span className="hint">{text.length}/{AI_LIMITS.description}. Only share what&apos;s true: the AI is told not to invent results or numbers, but you should read every line.</span>
      <Seg label="Language" value={language} options={[{ value: "en", label: "English" }, { value: "hi", label: "हिन्दी" }]} onChange={setLanguage} />
      {error && <p className="media-err" role="alert">{error}</p>}
      <button
        type="button"
        className="btn sm gold"
        disabled={busy || !enough}
        onClick={async () => {
          setBusy(true);
          setError("");
          const err = await onGenerate(text, language);
          setBusy(false);
          if (err) setError(err);
        }}
      >
        {busy ? "Writing… this takes a few seconds" : "Write my draft"}
      </button>
    </section>
  );
}
