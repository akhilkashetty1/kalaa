import Link from "next/link";
import { LandingFooter, LandingNav } from "@/components/landing-nav";
import { Rotating, Rv } from "@/components/landing-fx";
import { siteOrigin } from "@/server/tenant";
import { listPublicSites } from "@/server/data";
import { TEMPLATES } from "@/lib/templates";
import { LOOKS, PRESETS } from "@/lib/theme";

export const metadata = {
  title: "Kalaa: run your whole teaching business from one place",
  description: "Your website, courses, students, payments and team in one place. For independent educators in India.",
};

const STATUS = { live: "Live", soon: "Coming soon", part: "Listings today" } as const;

const PRODUCT: { icon: string; title: string; body: string; status: keyof typeof STATUS }[] = [
  { icon: "◐", title: "Your own website", body: "A site that looks like a real brand, on your own address, with templates written for your kind of teaching and a drag-and-drop editor.", status: "live" },
  { icon: "▦", title: "Courses and lessons", body: "Video lessons from YouTube or Vimeo, free previews, a library for every student, and progress that is saved lesson by lesson.", status: "live" },
  { icon: "☺", title: "Student sign-in", body: "Students sign in with a code sent to their email. No passwords to forget, and no app to install.", status: "live" },
  { icon: "₹", title: "Sales and payments", body: "Seat reservations, a UPI pay button, one-tap confirmation and a WhatsApp link to follow up, all in one list.", status: "live" },
  { icon: "☷", title: "Your team", body: "Give your co-founder, editor and support person their own access. They see only what their role needs.", status: "live" },
  { icon: "●", title: "Live batches", body: "Announce batches with dates and seats today. A built-in classroom for running them is next.", status: "part" },
  { icon: "◎", title: "Online payments", body: "Cards, UPI and netbanking collected for you, with automatic confirmation.", status: "soon" },
  { icon: "✦", title: "AI doubt assistant", body: "Answers students' questions from your own lessons, at 2 a.m., and tells you what confuses them.", status: "soon" },
  { icon: "▢", title: "Your own mobile app", body: "The same brand and library, in your students' pockets.", status: "soon" },
];

const TOOLS = ["Website builder", "YouTube links", "WhatsApp groups", "Google Forms", "Payment screenshots", "Excel sheets", "Zoom links"];

const ROLES = [
  { name: "Owner", body: "Everything, including the money and the team." },
  { name: "Co-owner", body: "Runs the business day to day: courses, payments, students." },
  { name: "Editor", body: "Edits the site and courses, with no access to student details." },
  { name: "Support", body: "Sees students and follows up. Changes nothing." },
];

const FAQ = [
  { q: "Do I need to be technical?", a: "No. Pick what you teach and you get a finished starting page. You change words by clicking on them." },
  { q: "Can I use my own domain?", a: "Yes. Add one record at your domain provider, then verify it in the studio. Until then you get a free kalaa address." },
  { q: "How do my students pay me?", a: "Today they reserve a seat and pay you by UPI. You confirm the payment with one tap and the course opens for them. Online payments with automatic confirmation are coming." },
  { q: "Who owns my students?", a: "You do. Each teacher's students belong to that teacher's site, and other teachers can't see them." },
  { q: "What does it cost?", a: "Kalaa is free while we're in early access. We'll announce simple pricing well before anything changes." },
];

export default async function Landing() {
  const demos = (await listPublicSites()).slice(0, 6);
  return (
    <div className="mk">
      <LandingNav />

      <section className="mk-hero">
        <div className="mk-enter">
          <p className="eyebrow">For independent educators in India</p>
          <h1>Run your whole teaching business <em>from one place</em>.</h1>
          <p className="mk-lede">
            Your website, courses, students, payments and team, working together. Whether you teach <Rotating words={["JEE", "yoga", "English", "tabla", "coding", "maths", "cooking"]} />, Kalaa replaces the pile of tools you juggle today.
          </p>
          <div className="mk-cta">
            <Link className="btn gold" href="/login?next=/studio">Start free</Link>
            <Link className="btn" href="/#product">See what's inside</Link>
          </div>
          <p className="mk-note">Free during early access. No card needed.</p>
        </div>
        <div className="mk-enter mk-mock-wrap" style={{ animationDelay: "180ms" }}>
          <div className="mk-mock" aria-hidden="true">
            <div className="mk-mock-bar"><i /><i /><i /><span>studio.kalaa</span></div>
            <div className="mk-mock-body">
              <ul className="mk-mock-nav"><li className="on">Overview</li><li>Site</li><li>Courses</li><li>Students</li><li>Payments</li><li>Team</li></ul>
              <div className="mk-mock-main">
                <div className="mk-mock-tiles">
                  <div><small>Awaiting payment</small><b>12</b></div>
                  <div><small>Paid this week</small><b>₹48,200</b></div>
                  <div><small>Lessons completed</small><b>340</b></div>
                </div>
                <div className="mk-mock-list">
                  <div><span className="dot ok" />Aarav K. paid for Mechanics <em>just now</em></div>
                  <div><span className="dot wait" />Sneha M. reserved a seat <em>5 min ago</em></div>
                  <div><span className="dot ok" />Rohan V. finished lesson 6 <em>1 hr ago</em></div>
                </div>
              </div>
            </div>
            <p className="mk-mock-cap">Illustration</p>
          </div>
        </div>
      </section>

      <section className="mk-sec mk-problem">
        <Rv>
          <p className="eyebrow">The problem</p>
          <h2>Most teachers run on seven tools held together by <em>WhatsApp</em>.</h2>
          <ul className="mk-tools">{TOOLS.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="mk-lede">Every one is fine alone. Together they cost you hours, lose you students and never show you the whole picture. Kalaa puts it all in one place.</p>
        </Rv>
      </section>

      <section className="mk-sec" id="product">
        <Rv>
          <p className="eyebrow">What's inside</p>
          <h2>One place for <em>everything</em> your classes need.</h2>
          <p className="mk-lede">Everything marked Live works today. We say plainly what is still coming.</p>
        </Rv>
        <div className="mk-grid">
          {PRODUCT.map((p, i) => (
            <Rv key={p.title} delay={(i % 3) * 80}>
              <article className={`mk-card ${p.status}`}>
                <span className="mk-ico">{p.icon}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
                <span className={`mk-tag ${p.status}`}>{STATUS[p.status]}</span>
              </article>
            </Rv>
          ))}
        </div>
      </section>

      <section className="mk-sec">
        <Rv>
          <p className="eyebrow">How it goes</p>
          <h2>From first student to a <em>steady income</em>.</h2>
        </Rv>
        <ol className="mk-steps">
          {[
            ["Set up in minutes", "Pick what you teach. You get a finished site, ready for your words."],
            ["Add your courses", "Upload lessons as video links, mark a few as free previews, set a price."],
            ["Take your first seat", "Share your link. Students reserve a seat and pay by UPI. You confirm in one tap."],
            ["Run it with a team", "Invite an editor or support person. Watch students learn, lesson by lesson."],
          ].map(([t, b], i) => (
            <Rv key={t} delay={i * 90}><li><span>{String(i + 1).padStart(2, "0")}</span><h3>{t}</h3><p>{b}</p></li></Rv>
          ))}
        </ol>
      </section>

      <section className="mk-sec" id="industries">
        <Rv>
          <p className="eyebrow">Who it's for</p>
          <h2>Built for how <em>you</em> teach.</h2>
          <p className="mk-lede">Each starting point has its own layout, look and wording, so you begin with something that already fits.</p>
        </Rv>
        <div className="mk-ind">
          {TEMPLATES.map((t, i) => {
            const pre = PRESETS[LOOKS[t.look].theme.preset as keyof typeof PRESETS];
            const accent = LOOKS[t.look].theme.accent as string;
            return (
              <Rv key={t.id} delay={(i % 4) * 70}>
                <Link className="mk-ind-card" href={`/login?next=${encodeURIComponent(`/studio?industry=${t.id}`)}`} style={{ background: pre.bg, color: pre.ink }}>
                  <i style={{ background: accent }} />
                  <b>{t.name}</b>
                  <span style={{ color: pre.muted }}>{t.who}</span>
                  <em style={{ color: accent }}>Start with this →</em>
                </Link>
              </Rv>
            );
          })}
        </div>
      </section>

      <section className="mk-sec mk-students" id="students">
        <div className="mk-two">
          <Rv>
            <p className="eyebrow">For your students</p>
            <h2>Learning that is <em>easy to start</em> and easy to keep up.</h2>
            <ul className="mk-ticks">
              <li>Sign in with a code sent to their email. No password, no app.</li>
              <li>Watch free previews before paying.</li>
              <li>Pay with any UPI app, straight from the page.</li>
              <li>A library of their courses, with progress saved and a button to resume.</li>
              <li>The page in English or Hindi.</li>
            </ul>
          </Rv>
          <Rv delay={140}>
            <div className="mk-phone" aria-hidden="true">
              <b>Your courses</b>
              <div className="mk-lib"><span>Mechanics from First Principles</span><div><i style={{ width: "62%" }} /></div><small>5 of 8 lessons done</small></div>
              <div className="mk-lib"><span>Electrostatics Sprint</span><div><i style={{ width: "20%" }} /></div><small>1 of 6 lessons done</small></div>
              <p>Illustration</p>
            </div>
          </Rv>
        </div>
      </section>

      <section className="mk-sec">
        <Rv>
          <p className="eyebrow">For your team</p>
          <h2>Everyone sees what they <em>need</em>, and nothing more.</h2>
        </Rv>
        <div className="mk-roles">
          {ROLES.map((r, i) => <Rv key={r.name} delay={i * 80}><div className="mk-role"><b>{r.name}</b><p>{r.body}</p></div></Rv>)}
        </div>
      </section>

      {demos.length > 0 && (
        <section className="mk-sec">
          <Rv>
            <p className="eyebrow">See it in action</p>
            <h2>Sites teachers are <em>building</em> on Kalaa.</h2>
            <p className="mk-lede">These are demo sites made with the same templates you'll start from.</p>
          </Rv>
          <div className="mk-demos">
            {demos.map(({ site, courses }, i) => {
              const pre = PRESETS[site.theme.preset];
              return (
                <Rv key={site.id} delay={(i % 3) * 80}>
                  <a className="mk-demo" href={siteOrigin(site)} style={{ background: pre.bg, color: pre.ink }}>
                    <i style={{ background: site.theme.accent }} />
                    <b>{site.name}</b>
                    <span style={{ color: pre.muted }}>{site.creator.name} · {courses.length} {courses.length === 1 ? "course" : "courses"}</span>
                    <em style={{ color: site.theme.accent }}>Visit demo ↗</em>
                  </a>
                </Rv>
              );
            })}
          </div>
          <p className="mk-more"><Link href="/explore">Browse all teachers on Explore →</Link></p>
        </section>
      )}

      <section className="mk-sec mk-faq">
        <Rv><p className="eyebrow">Questions</p><h2>Before you <em>start</em>.</h2></Rv>
        <div>
          {FAQ.map((f) => (
            <Rv key={f.q}><details><summary>{f.q}</summary><p>{f.a}</p></details></Rv>
          ))}
        </div>
      </section>

      <section className="mk-final">
        <Rv>
          <h2>Your classes deserve a <em>proper home</em>.</h2>
          <p className="mk-lede">Start free today. Your first page is ready in minutes.</p>
          <div className="mk-cta"><Link className="btn gold" href="/login?next=/studio">Start free</Link><Link className="btn" href="/explore">I'm a student</Link></div>
        </Rv>
      </section>

      <LandingFooter />
    </div>
  );
}
