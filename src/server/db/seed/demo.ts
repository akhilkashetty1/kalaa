import { randomUUID } from "node:crypto";
import { lessonKey } from "@/lib/lessons";
import { starterBlocks, type TemplateId } from "@/lib/templates";
import { DEFAULT_THEME, LOOKS } from "@/lib/theme";
import type { Dataset } from "./dataset";
import type { Course, Creator, Lesson, Site } from "@/lib/types";

// Demo teachers and a demo student, so a fresh install has an Explore page worth browsing and a learner
// account to try. Idempotent: it only adds what's missing, keyed by slug and email, and never edits your own data.
// Used when seeding, and topped up into existing local data outside production.

export const DEMO_LEARNER = "demo.learner@example.com";
const VIDEO = "https://www.youtube.com/watch?v=jNQXAC9IVRw"; // a public placeholder clip

const lessons = (titles: string[], freeCount = 2): Lesson[] => titles.map((title, i) => ({ title, minutes: 8 + ((i * 5) % 14), free: i < freeCount, ...(i < 4 ? { url: VIDEO } : {}) }));

type DemoCourse = { slug: string; title: string; summary: string; price: number; mrp?: number; tag?: string; lessons: string[] };
type DemoSite = { slug: string; name: string; template: TemplateId; look: string; teacher: string; email: string; role: string; headline: string; bio: string; courses: DemoCourse[] };

const SITES: DemoSite[] = [
  { slug: "speakeasy", name: "SpeakEasy English", template: "language", look: "fresh", teacher: "Divya Nair", email: "divya@example.com", role: "Spoken English coach", headline: "Start speaking *confidently* from day one", bio: "Short daily lessons and live practice, so you speak with confidence, not just understand.",
    courses: [{ slug: "spoken-english-30-days", title: "Spoken English in 30 Days", summary: "Daily ten-minute lessons and weekly live practice.", price: 1999, mrp: 2999, tag: "Bestseller", lessons: ["Introduce yourself", "Everyday small talk", "Ordering and asking", "Talking about your day", "Telling a short story", "Handling surprises"] }, { slug: "interview-english", title: "Interview English", summary: "Answer common questions clearly and calmly.", price: 1499, lessons: ["Your two-minute introduction", "Describing your experience", "Answering tricky questions", "Mock interview"] }] },
  { slug: "flowstate", name: "Flow State Yoga", template: "fitness", look: "saffron", teacher: "Kavya Rao", email: "kavya@example.com", role: "Yoga teacher", headline: "Move *better*. Feel stronger.", bio: "Guided yoga and mobility you can do at home, with a plan that fits real life.",
    courses: [{ slug: "yoga-reset-21", title: "21-Day Yoga Reset", summary: "A gentle daily practice to rebuild your habit.", price: 999, tag: "Popular", lessons: ["Day 1: Wake up the body", "Day 2: Hips and hamstrings", "Day 3: Breath and balance", "Day 4: Strong shoulders", "Day 5: Wind down"] }, { slug: "strength-basics", title: "Strength Basics", summary: "Build a base with bodyweight strength.", price: 1799, lessons: ["Form first", "Push", "Pull", "Legs and core"] }] },
  { slug: "codecraft", name: "CodeCraft Studio", template: "skills", look: "neon", teacher: "Arjun Patel", email: "arjun@example.com", role: "Software engineer and mentor", headline: "Learn to code. Ship real *projects*.", bio: "Project-based courses that take you from beginner to a portfolio you can show.",
    courses: [{ slug: "web-dev-bootcamp", title: "Web Development Bootcamp", summary: "HTML, CSS and JavaScript by building three real sites.", price: 7999, mrp: 11999, tag: "Cohort", lessons: ["How the web works", "HTML that makes sense", "CSS layout", "JavaScript basics", "Your first project", "Deploying it"] }, { slug: "python-beginners", title: "Python for Beginners", summary: "Write useful scripts from day one.", price: 2499, lessons: ["Setting up", "Variables and types", "Loops and functions", "A small project"] }] },
  { slug: "littlescholars", name: "Little Scholars Tuition", template: "school", look: "playful", teacher: "Sunita Menon", email: "sunita@example.com", role: "Maths and science tutor", headline: "Learning that finally *clicks*", bio: "Patient, friendly tuition for classes 6 to 10, with progress parents can see.",
    courses: [{ slug: "class-8-maths", title: "Class 8 Maths", summary: "Chapter by chapter, with practice after every lesson.", price: 1299, tag: "CBSE", lessons: ["Rational numbers", "Linear equations", "Understanding quadrilaterals", "Practical geometry"] }, { slug: "class-10-science", title: "Class 10 Science", summary: "Board-exam focused, with clear diagrams.", price: 1499, lessons: ["Chemical reactions", "Acids, bases and salts", "Life processes", "Light"] }] },
  { slug: "spiceroute", name: "Spice Route Kitchen", template: "personal", look: "obsidian", teacher: "Meenakshi Iyer", email: "meenakshi@example.com", role: "Home cook and food writer", headline: "Cook the food you *grew up* on", bio: "Step-by-step South Indian home cooking, from breakfast to festival feasts.",
    courses: [{ slug: "south-indian-breakfasts", title: "South Indian Breakfasts", summary: "Idli, dosa, pongal and the chutneys that go with them.", price: 899, tag: "Beginner", lessons: ["The perfect batter", "Soft idli", "Crisp dosa", "Pongal and sambar", "Chutneys"] }] },
];

/** Adds whatever demo content is missing. Returns true if it changed anything. */
export function addDemoContent(db: Dataset): boolean {
  let changed = false;
  const now = new Date().toISOString();

  // Older local data: tag the two original demo sites so they show up under the right category.
  for (const [slug, category] of [["thephysicsroom", "exam"], ["sursangam", "music"]] as const) {
    const s = db.sites.find((x) => x.slug === slug);
    if (s && !s.category) { s.category = category; s.listed = true; changed = true; }
    if (s && !s.upiId) { s.upiId = "demo@example"; s.payNote = "This is a demo site, so no real payment is taken."; changed = true; }
  }

  for (const d of SITES) {
    if (db.sites.some((s) => s.slug === d.slug)) continue;
    let owner: Creator | undefined = db.creators.find((c) => c.email === d.email);
    if (!owner) { owner = { id: randomUUID(), email: d.email, name: d.teacher, createdAt: now }; db.creators.push(owner); }
    const site: Site = {
      id: randomUUID(), ownerId: owner.id, slug: d.slug, name: d.name, headline: d.headline, bio: d.bio,
      creator: { name: d.teacher, title: d.role, rating: 4.8 },
      stats: { learners: 800, rating: 4.8, results: 120, resultsLabel: "happy learners" }, live: [], quotes: [],
      community: { title: "Ready when *you* are", body: "Try a free lesson today.", cta: "Start free" },
      theme: { ...DEFAULT_THEME, ...LOOKS[d.look].theme, custom: undefined },
      category: d.template, listed: true, upiId: "demo@example", payNote: "This is a demo site, so no real payment is taken.", createdAt: now,
    };
    site.blocks = starterBlocks(d.template, site, { useSiteCopy: true });
    db.sites.push(site);
    for (const c of d.courses) {
      db.courses.push({ id: randomUUID(), siteId: site.id, slug: c.slug, title: c.title, summary: c.summary, priceInr: c.price, mrpInr: c.mrp, tag: c.tag, lessons: lessons(c.lessons), published: true, createdAt: now } satisfies Course);
    }
    changed = true;
  }

  // A demo student on The Physics Room and Sur Sangam, with courses already paid for and some progress saved.
  const physics = db.sites.find((s) => s.slug === "thephysicsroom");
  const music = db.sites.find((s) => s.slug === "sursangam");
  const giveAccess = (site: Site | undefined, slugs: string[], paid: boolean) => {
    if (!site) return;
    for (const slug of slugs) {
      const course = db.courses.find((c) => c.siteId === site.id && c.slug === slug);
      if (!course || db.enrollments.some((e) => e.siteId === site.id && e.courseId === course.id && e.email === DEMO_LEARNER)) continue;
      db.enrollments.push({ id: randomUUID(), siteId: site.id, courseId: course.id, name: "Demo Learner", email: DEMO_LEARNER, phone: "9800000000", status: paid ? "paid" : "pending_payment", createdAt: now, ...(paid ? { paidAt: now, paidBy: site.ownerId } : {}) });
      changed = true;
    }
  };
  giveAccess(physics, ["mechanics-from-first-principles", "electrostatics-sprint"], true);
  giveAccess(physics, ["jee-advanced-problem-lab"], false); // a reservation still waiting on payment
  giveAccess(music, ["foundations-of-sur"], true);

  if (physics && !db.learners.some((l) => l.siteId === physics.id && l.email === DEMO_LEARNER)) {
    const learner = { id: randomUUID(), siteId: physics.id, email: DEMO_LEARNER, name: "Demo Learner", createdAt: now };
    db.learners.push(learner);
    const mech = db.courses.find((c) => c.siteId === physics.id && c.slug === "mechanics-from-first-principles");
    if (mech) {
      const done = mech.lessons.slice(0, 3).map((l) => lessonKey(l.title));
      db.progress.push({ learnerId: learner.id, courseId: mech.id, siteId: physics.id, completed: done, lastLesson: lessonKey(mech.lessons[3]?.title ?? mech.lessons[0].title), updatedAt: now });
    }
    changed = true;
  }
  return changed;
}
