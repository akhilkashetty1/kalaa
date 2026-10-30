"use client";

import { useState, useTransition } from "react";
import { announceToStudents } from "@/app/studio/actions";
import { MAX_BODY, MAX_SUBJECT } from "@/lib/announce-limits";

type Course = { id: string; title: string; paid: number };

/** Write once, send a test to yourself, then send to everyone who has paid for the course. Sending asks for a second click. */
export function AnnouncementForm({ slug, courses, senderEmail }: { slug: string; courses: Course[]; senderEmail: string }) {
  const eligible = courses.filter((c) => c.paid > 0);
  const [courseId, setCourseId] = useState(eligible[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [pending, start] = useTransition();
  const course = eligible.find((c) => c.id === courseId);

  if (!eligible.length) {
    return <p className="empty">Once a student has paid for a course, you can email everyone in it from here.</p>;
  }

  const run = (test: boolean) =>
    start(async () => {
      const res = await announceToStudents(slug, { courseId, subject, body, test });
      setMsg(res);
      setArmed(false);
      if (!test && res.ok) { setSubject(""); setBody(""); }
    });

  return (
    <div className="card-b" style={{ display: "grid", gap: 14 }}>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="an-course">To</label>
          <select className="input" id="an-course" value={courseId} onChange={(e) => { setCourseId(e.target.value); setArmed(false); }}>
            {eligible.map((c) => <option key={c.id} value={c.id}>{c.title} · {c.paid} paid {c.paid === 1 ? "student" : "students"}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="an-subject">Subject</label>
          <input className="input" id="an-subject" value={subject} maxLength={MAX_SUBJECT} onChange={(e) => { setSubject(e.target.value); setArmed(false); }} placeholder="Tomorrow's class moves to 7 pm" />
        </div>
        <div className="field full">
          <label htmlFor="an-body">Message</label>
          <textarea className="input prose" id="an-body" rows={6} value={body} maxLength={MAX_BODY} onChange={(e) => { setBody(e.target.value); setArmed(false); }} placeholder={"Write it like a note to your class. Each student sees their own first name above it."} />
          <span className="hint">{body.length}/{MAX_BODY}. Plain text only. Replies come to {senderEmail}.</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn sm" type="button" disabled={pending || !subject.trim() || !body.trim()} onClick={() => run(true)}>Send me a test</button>
        {armed ? (
          <>
            <button className="btn gold sm" type="button" disabled={pending} onClick={() => run(false)}>{pending ? "Sending…" : `Yes, send to ${course?.paid} ${course?.paid === 1 ? "student" : "students"}`}</button>
            <button className="btn sm" type="button" onClick={() => setArmed(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn gold sm" type="button" disabled={pending || !subject.trim() || !body.trim()} onClick={() => setArmed(true)}>Send to {course?.paid} {course?.paid === 1 ? "student" : "students"}…</button>
        )}
        {msg.error && <span className="error" role="alert">{msg.error}</span>}
        {msg.ok && <span className="hint" role="status" style={{ color: "var(--good)" }}>{msg.ok}</span>}
      </div>
    </div>
  );
}
