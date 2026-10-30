import { newBlock, sanitizeBlocks } from "./blocks";
import type { Block, Site } from "./types";

// Industry templates. A template is a layout, a recommended look and starter copy written for one kind of
// teaching business. New sites get placeholder copy only: no invented numbers and no invented student quotes,
// so nobody publishes fake social proof by accident. Demo sites pass `useSiteCopy` to keep their own words.

type Seed = Pick<Site, "name" | "headline" | "bio" | "creator" | "stats" | "live" | "quotes" | "community">;
type Item = Record<string, string>;

type Def = {
  name: string;
  who: string;
  blurb: string;
  look: string;
  hero: "arc" | "orb" | "split" | "statement";
  headline: (first: string) => string;
  body: string;
  ticker: string[];
  statement: string;
  stats: Item[];
  features: { title: string; items: Item[] };
  steps: { title: string; items: Item[] };
  courses: { layout: "grid" | "arc" | "rail"; title: string; subtitle: string };
  quotes: "spotlight" | "grid";
  faq: Item[];
  cta: { headline: string; body: string; label: string };
  /** The order of sections. */
  page: string[];
};

const DEFS = {
  exam: {
    name: "Exam coaching",
    who: "JEE, NEET, UPSC, CA, boards and other exam prep",
    blurb: "Oversized type, a 3D arc of courses, full-screen results and live doubt sessions.",
    look: "spoon",
    hero: "arc",
    headline: (f) => `Crack the exam with *${f}*, not with guesswork`,
    body: "Concept-first lessons, daily practice and live doubt sessions that build real understanding.",
    ticker: ["Concept-first lessons", "Live doubt sessions", "Weekly mock tests", "Daily practice", "Rank tracking"],
    statement: "We teach the *idea* first, then the formula. Every lesson starts with a question you can see, not a rule to memorise.",
    stats: [{ value: "10,000+", label: "learners taught" }, { value: "4.9", label: "average rating" }, { value: "300+", label: "top results" }],
    features: { title: "Built around how toppers *actually* prepare", items: [{ icon: "✦", title: "Short lessons", body: "Ten minutes at a time, so it fits around school and sleep." }, { icon: "◎", title: "Live doubt sessions", body: "Ask in real time. Every session is recorded for later." }, { icon: "↗", title: "Daily practice", body: "A five-minute set keeps yesterday's idea fresh." }, { icon: "☰", title: "Mock tests", body: "Exam-style papers with worked solutions." }] },
    steps: { title: "From first lesson to *top rank*", items: [{ title: "Watch the free lesson", body: "No sign-up. Decide if the teaching fits you." }, { title: "Join your batch", body: "Small groups, a fixed schedule, real accountability." }, { title: "Practise daily", body: "Short sets and a weekly mock." }, { title: "Rank up", body: "Track progress and fix weak spots fast." }] },
    courses: { layout: "grid", title: "Start anywhere", subtitle: "Every course has free preview lessons." },
    quotes: "spotlight",
    faq: [{ q: "Can I try a lesson before I pay?", a: "Yes. Every course has free preview lessons you can watch without paying." }, { q: "How do I pay?", a: "Reserve a seat and you'll see how to pay by UPI. Once your payment is confirmed, the course opens in your library." }, { q: "Will I get recordings?", a: "Every live class is recorded and added to your course." }, { q: "Is there a refund?", a: "Ask us on WhatsApp within the first week and we'll sort it out." }],
    cta: { headline: "Your best attempt starts *today*", body: "Watch a free lesson and see if it clicks.", label: "Start a free lesson" },
    page: ["hero", "marquee", "statement", "stats", "courses", "features", "steps", "live", "quotes", "faq", "cta"],
  },
  skills: {
    name: "Skills & careers",
    who: "Coding, design, data, marketing, finance and other career skills",
    blurb: "A 3D orb, project-led cohorts and a bento grid of outcomes, on a deep indigo look.",
    look: "neon",
    hero: "orb",
    headline: (f) => `Learn the skill. Ship the *project*. With ${f}.`,
    body: "Project-based cohorts and recorded courses that take you from beginner to something you can show.",
    ticker: ["Project-based", "Live cohorts", "Code reviews", "Portfolio ready", "Career support"],
    statement: "You don't learn a skill by watching. You learn it by *building* something real, getting feedback, and building again.",
    stats: [{ value: "1,000+", label: "learners" }, { value: "4.8", label: "average rating" }, { value: "50+", label: "projects shipped" }],
    features: { title: "Everything you need to *get good*", items: [{ icon: "▣", title: "Real projects", body: "Every module ends with something you can put in a portfolio." }, { icon: "◎", title: "Live reviews", body: "Get feedback on your work from someone who has done it." }, { icon: "↻", title: "Lifetime access", body: "Revisit lessons whenever you need a refresher." }, { icon: "☰", title: "Clear roadmap", body: "Know what to learn next, and why." }] },
    steps: { title: "A cohort that *moves*", items: [{ title: "Week 1: Foundations", body: "Set up, learn the basics and ship a tiny project." }, { title: "Weeks 2–3: Build", body: "Work through the core project with weekly reviews." }, { title: "Week 4: Polish", body: "Refine, document and present your work." }, { title: "After: Keep going", body: "Stay in the community and keep building." }] },
    courses: { layout: "rail", title: "Pick your path", subtitle: "Self-paced courses and live cohorts." },
    quotes: "grid",
    faq: [{ q: "Do I need experience?", a: "Not for the beginner courses. Each course says who it is for." }, { q: "How much time per week?", a: "Plan on 4 to 6 hours. Lessons are recorded, so you can fit them in." }, { q: "How do I pay?", a: "Reserve a seat and you'll see how to pay by UPI. Your course opens once payment is confirmed." }],
    cta: { headline: "Build something you're *proud of*", body: "Start with a free preview lesson.", label: "Start free preview" },
    page: ["hero", "marquee", "features", "courses", "steps", "about", "stats", "quotes", "faq", "cta"],
  },
  language: {
    name: "Language & communication",
    who: "Spoken English, Kannada, Hindi, German, IELTS and public speaking",
    blurb: "Friendly colour, speak-from-day-one steps and live practice sessions.",
    look: "fresh",
    hero: "split",
    headline: (f) => `Start speaking from *day one* with ${f}`,
    body: "Short daily lessons and live conversation practice, so you speak with confidence, not just understand.",
    ticker: ["Namaste", "Hello", "Hola", "Guten Tag", "Vanakkam", "Bonjour"],
    statement: "You don't need more grammar. You need to *speak*, make mistakes in a safe place, and do it again tomorrow.",
    stats: [{ value: "5,000+", label: "learners" }, { value: "30", label: "days to your first conversation" }, { value: "4.9", label: "average rating" }],
    features: { title: "Practice that *feels natural*", items: [{ icon: "☺", title: "Speak from day one", body: "Every lesson ends with something you say out loud." }, { icon: "◎", title: "Live practice", body: "Small groups where everyone talks." }, { icon: "✎", title: "Gentle feedback", body: "Clear corrections without the embarrassment." }, { icon: "↻", title: "Daily habit", body: "Ten minutes a day builds fluency." }] },
    steps: { title: "Your first *30 days*", items: [{ title: "Week 1", body: "Greetings, introductions and the sounds that matter." }, { title: "Week 2", body: "Everyday conversations: food, travel, work." }, { title: "Week 3", body: "Tell stories and handle surprises." }, { title: "Week 4", body: "Hold a real conversation with a classmate." }] },
    courses: { layout: "grid", title: "Choose your level", subtitle: "Beginner to confident." },
    quotes: "spotlight",
    faq: [{ q: "I'm a complete beginner. Is that okay?", a: "Yes. The beginner course assumes no knowledge." }, { q: "Are classes live?", a: "Yes, with recordings if you miss one." }, { q: "How do I pay?", a: "Reserve a seat and you'll see how to pay by UPI. Your course opens once payment is confirmed." }],
    cta: { headline: "Say your first *sentence* today", body: "Try a free lesson and start speaking.", label: "Try a free lesson" },
    page: ["hero", "marquee", "stats", "courses", "statement", "steps", "live", "quotes", "faq", "cta"],
  },
  music: {
    name: "Music & performing arts",
    who: "Classical and film music, instruments, dance and theatre",
    blurb: "A warm 3D orb, your story up front and live practice circles, in rosewood and gold.",
    look: "salon",
    hero: "orb",
    headline: (f) => `Find your *voice*, one practice at a time, with ${f}`,
    body: "Guided lessons, practice plans and live feedback on your recordings, from a working artist.",
    ticker: ["Riyaz plans", "Live feedback", "Recorded lessons", "Practice circles", "Performance prep"],
    statement: "Art is not learned in a day. It is built in *small daily practice*, with someone who listens closely and tells you the truth.",
    stats: [{ value: "2,000+", label: "students" }, { value: "10", label: "years teaching" }, { value: "4.8", label: "average rating" }],
    features: { title: "Training that *respects the craft*", items: [{ icon: "♪", title: "Daily practice plans", body: "A clear routine for every level." }, { icon: "◎", title: "Feedback on your recordings", body: "Specific notes you can act on." }, { icon: "◉", title: "Live practice circles", body: "Learn alongside others, on a schedule." }, { icon: "☰", title: "Graded lessons", body: "Move up when you are ready, not before." }] },
    steps: { title: "How the *journey* goes", items: [{ title: "Listen and imitate", body: "Start with the basics, slowly and correctly." }, { title: "Build a routine", body: "A short daily practice that you can keep." }, { title: "Share a recording", body: "Get feedback and refine." }, { title: "Perform", body: "Take what you've learned to an audience." }] },
    courses: { layout: "rail", title: "Begin your training", subtitle: "From first notes to performance." },
    quotes: "spotlight",
    faq: [{ q: "Do I need an instrument?", a: "Each course says what you need. Many start with just your voice." }, { q: "Can children join?", a: "Yes. Tell us their age and we'll suggest the right course." }, { q: "How do I pay?", a: "Reserve a seat and you'll see how to pay by UPI. Your course opens once payment is confirmed." }],
    cta: { headline: "Begin with *one note*", body: "Try a free lesson and hear the difference.", label: "Try a free lesson" },
    page: ["hero", "about", "courses", "statement", "features", "live", "quotes", "faq", "cta"],
  },
  fitness: {
    name: "Fitness & wellness",
    who: "Yoga, strength training, nutrition and mindfulness",
    blurb: "Warm ember colour, big numbers, a daily routine and gentle accountability.",
    look: "saffron",
    hero: "statement",
    headline: (f) => `Move *better*. Feel stronger. With ${f}.`,
    body: "Guided sessions you can do at home, with a plan that fits real life and a coach who keeps you going.",
    ticker: ["Yoga", "Strength", "Mobility", "Nutrition", "Mindfulness", "Daily plans"],
    statement: "Consistency beats intensity. We build a routine you can *actually keep*, then make it a little better every week.",
    stats: [{ value: "3,000+", label: "members" }, { value: "21", label: "day starter plan" }, { value: "4.9", label: "average rating" }],
    features: { title: "A plan that *fits your life*", items: [{ icon: "◔", title: "20-minute sessions", body: "Short enough to do every day." }, { icon: "◎", title: "Live classes", body: "Move together, with a coach watching your form." }, { icon: "☰", title: "Weekly plans", body: "Know exactly what to do each day." }, { icon: "↻", title: "Gentle accountability", body: "Check-ins that keep you going." }] },
    steps: { title: "Your first *three weeks*", items: [{ title: "Week 1: Start", body: "Easy sessions that build the habit." }, { title: "Week 2: Build", body: "A little more each day." }, { title: "Week 3: Grow", body: "Stronger, more flexible, more confident." }] },
    courses: { layout: "grid", title: "Pick a programme", subtitle: "Start with a free session." },
    quotes: "grid",
    faq: [{ q: "I'm out of shape. Can I join?", a: "Yes. Every programme has an easy starting point." }, { q: "Do I need equipment?", a: "Each programme lists what you need. Most need none." }, { q: "How do I pay?", a: "Reserve a seat and you'll see how to pay by UPI. Your programme opens once payment is confirmed." }],
    cta: { headline: "Your first session is *free*", body: "Roll out a mat and begin.", label: "Start free session" },
    page: ["hero", "marquee", "statement", "stats", "courses", "features", "steps", "live", "quotes", "faq", "cta"],
  },
  school: {
    name: "School & tuition",
    who: "K-12 tuition, board exams, homework help and parents",
    blurb: "Playful, round and reassuring, with a section for parents and clear weekly structure.",
    look: "playful",
    hero: "split",
    headline: (f) => `Learning that finally *clicks*, with ${f}`,
    body: "Friendly lessons and regular practice, with progress updates parents can trust.",
    ticker: ["Maths", "Science", "English", "Board exam prep", "Homework help", "Doubt clearing"],
    statement: "Children learn best when they feel *safe to ask*. We explain patiently, practise often and celebrate progress.",
    stats: [{ value: "1,500+", label: "students helped" }, { value: "4.9", label: "parent rating" }, { value: "Classes 1–12", label: "all boards" }],
    features: { title: "Made for *students and parents*", items: [{ icon: "☺", title: "Patient teaching", body: "No question is too small." }, { icon: "☰", title: "Weekly plan", body: "Parents know what is covered each week." }, { icon: "◎", title: "Doubt sessions", body: "Live help before every test." }, { icon: "✎", title: "Practice sheets", body: "Short sets that build confidence." }] },
    steps: { title: "How a *week* works", items: [{ title: "Monday: New topic", body: "A clear lesson and an example." }, { title: "Midweek: Practice", body: "Short exercises with answers." }, { title: "Friday: Doubts", body: "Live session to clear anything pending." }] },
    courses: { layout: "grid", title: "Choose a class", subtitle: "For every grade and board." },
    quotes: "grid",
    faq: [{ q: "Which boards do you cover?", a: "The courses list the board and class they follow." }, { q: "How will I know my child is progressing?", a: "Each course shows lesson progress, and we share updates with parents." }, { q: "How do I pay?", a: "Reserve a seat and you'll see how to pay by UPI. The course opens once payment is confirmed." }],
    cta: { headline: "Give them a *great start*", body: "Try a free lesson together.", label: "Try a free lesson" },
    page: ["hero", "marquee", "stats", "courses", "features", "steps", "about", "faq", "quotes", "cta"],
  },
  personal: {
    name: "Creator & hobby",
    who: "Cooking, art, photography, crafts and personal brands",
    blurb: "A calm, gallery-like page with your story, a rail of courses and a clear invitation.",
    look: "obsidian",
    hero: "orb",
    headline: (f) => `Learn the craft with *${f}*`,
    body: "Hands-on lessons you can follow at your own pace, from someone who does this every day.",
    ticker: ["Hands-on", "At your own pace", "Step by step", "Beginner friendly"],
    statement: "The best way to learn a craft is to *make something*, early and often, with someone showing you how.",
    stats: [{ value: "500+", label: "learners" }, { value: "4.9", label: "average rating" }, { value: "40+", label: "lessons" }],
    features: { title: "What you'll *get*", items: [{ icon: "✦", title: "Clear lessons", body: "Step by step, with nothing skipped." }, { icon: "☰", title: "Materials list", body: "Know what you need before you start." }, { icon: "◎", title: "Ask questions", body: "Get help when you're stuck." }] },
    steps: { title: "How it *works*", items: [{ title: "Pick a course", body: "Start with the beginner one." }, { title: "Follow along", body: "Pause, rewind and repeat." }, { title: "Share your work", body: "Show what you made." }] },
    courses: { layout: "rail", title: "Courses", subtitle: "Learn at your own pace." },
    quotes: "spotlight",
    faq: [{ q: "Is this for beginners?", a: "Yes. Each course says who it is for." }, { q: "How long do I have access?", a: "Once your payment is confirmed, the course stays in your library." }, { q: "How do I pay?", a: "Reserve a seat and you'll see how to pay by UPI." }],
    cta: { headline: "Make your *first one* today", body: "Try a free lesson.", label: "Try a free lesson" },
    page: ["hero", "about", "courses", "statement", "features", "faq", "cta"],
  },
} satisfies Record<string, Def>;

export type TemplateId = keyof typeof DEFS;
export const TEMPLATES = (Object.keys(DEFS) as TemplateId[]).map((id) => ({ id, ...DEFS[id] }));
export const templateName = (id?: string) => (id && id in DEFS ? DEFS[id as TemplateId].name : "Other");
export const isTemplateId = (v: unknown): v is TemplateId => typeof v === "string" && v in DEFS;

export function starterBlocks(id: TemplateId, s: Seed, opts: { useSiteCopy?: boolean } = {}): Block[] {
  const d: Def = DEFS[id];
  const mine = !!opts.useSiteCopy;
  const first = s.creator.name.split(" ")[0] || "your teacher";
  const stats = mine && s.stats.learners ? [{ value: `${s.stats.learners.toLocaleString("en-IN")}+`, label: "learners taught" }, { value: s.stats.rating.toFixed(1), label: "average rating" }, { value: s.stats.results.toLocaleString("en-IN"), label: s.stats.resultsLabel }] : d.stats;

  const build = (type: string): Block | null => {
    switch (type) {
      case "hero": return newBlock("hero", { variant: d.hero, headline: mine && s.headline ? s.headline : d.headline(first), body: mine && s.bio ? s.bio : d.body, ctaLabel: d.cta.label });
      case "marquee": return newBlock("marquee", { items: d.ticker.map((text) => ({ text })) });
      case "statement": return newBlock("statement", { text: d.statement });
      // Numbers and testimonials are only filled in for demo sites; a real new site adds its own when it has them.
      case "stats": return mine ? newBlock("stats", { variant: d.hero === "split" ? "row" : "giant", items: stats }) : null;
      case "quotes": return mine && s.quotes.length ? newBlock("quotes", { variant: d.quotes, items: s.quotes.map((q) => ({ text: q.text, author: q.author, detail: q.detail })) }) : null;
      case "courses": return newBlock("courses", { layout: d.courses.layout, title: d.courses.title, subtitle: d.courses.subtitle });
      case "features": return newBlock("features", { title: d.features.title, items: d.features.items });
      case "steps": return newBlock("steps", { title: d.steps.title, items: d.steps.items });
      case "live": return mine && s.live.length ? newBlock("live", { items: s.live.map((b) => ({ title: b.title, date: b.startsOn, schedule: b.schedule, seats: b.seatsLeft })) }) : newBlock("live", {}, { hidden: true }); // an example for the teacher to fill in, not shown until they unhide it
      case "about": return newBlock("about", { title: `Hi, I'm ${first}`, body: mine && s.bio ? s.bio : "Tell learners who you are, why you teach and what they can expect from you.", name: s.creator.name, role: s.creator.title, items: [{ text: s.creator.title }] });
      case "faq": return newBlock("faq", { items: d.faq });
      case "cta": return newBlock("cta", { headline: d.cta.headline, body: mine && s.community.body ? s.community.body : d.cta.body, ctaLabel: mine && s.community.cta ? s.community.cta : d.cta.label });
      default: return null;
    }
  };
  return sanitizeBlocks(d.page.map(build).filter((b): b is Block => b !== null));
}
