import { randomUUID } from "node:crypto";
import { DEFAULT_THEME, LOOKS } from "@/lib/theme";
import { addDemoContent } from "./demo";
import { starterBlocks } from "@/lib/templates";
import type { Dataset } from "./dataset";
import type { Course, Creator, Lesson, Membership, Site } from "@/lib/types";

// Two sample creators so multi-tenancy is visible on first run.

// Sample lesson videos all point at one public placeholder clip ("Me at the zoo") so the player has
// something to show. Creators replace these links in the studio.
const SAMPLE_VIDEO = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

const lessons = (titles: string[], freeCount = 3, withVideo: number[] = []): Lesson[] =>
  titles.map((title, i) => ({ title, minutes: 9 + ((i * 7) % 17), free: i < freeCount, ...(withVideo.includes(i) ? { url: SAMPLE_VIDEO } : {}) }));

export function seedDataset(): Dataset {
  const now = new Date().toISOString();

  // Sign in as either creator with these addresses; the code is printed to the dev server log.
  const ishaan: Creator = { id: randomUUID(), email: "ishaan@example.com", name: "Ishaan Mehra", createdAt: now };
  const meher: Creator = { id: randomUUID(), email: "meher@example.com", name: "Meher Kulkarni", createdAt: now };
  // Teammates on The Physics Room, so every role can be tried locally.
  const riya: Creator = { id: randomUUID(), email: "riya@example.com", name: "Riya Sharma", createdAt: now };
  const karan: Creator = { id: randomUUID(), email: "karan@example.com", name: "Karan Verma", createdAt: now };
  const anita: Creator = { id: randomUUID(), email: "anita@example.com", name: "Anita Mehra", createdAt: now };

  const physics: Site = {
    id: randomUUID(),
    ownerId: ishaan.id,
    slug: "thephysicsroom",
    name: "The Physics Room",
    headline: "Physics that finally makes *sense*.",
    headlineHi: "फिज़िक्स, जो आखिरकार *समझ* आए।",
    bio: "Concept-first lessons for JEE and NEET from an IIT Bombay alumnus. Short videos, daily practice and live doubt nights that build real intuition.",
    creator: { name: "Ishaan Mehra", title: "IIT Bombay · 9 yrs teaching", rating: 4.9 },
    stats: { learners: 18400, rating: 4.9, results: 312, resultsLabel: "JEE Adv. selections, 2026" },
    live: [
      { id: randomUUID(), title: "Rotational Motion Bootcamp", startsOn: "2026-11-04", schedule: "Tue, Thu, Sat · 7:00 pm IST · 6 weeks", seatsLeft: 12 },
      { id: randomUUID(), title: "Modern Physics in 10 Nights", startsOn: "2026-11-11", schedule: "Mon to Fri · 8:30 pm IST · 2 weeks", seatsLeft: 31 },
    ],
    quotes: [
      { id: randomUUID(), text: "I stopped memorising formulas. I could see the problem before solving it.", author: "Aditi P.", detail: "AIR 1,184 · JEE Adv. 2026" },
      { id: randomUUID(), text: "The doubt nights quoted the exact minute Ishaan sir explained it.", author: "Rohan V.", detail: "Class 12, Kota" },
      { id: randomUUID(), text: "Hindi explanations with English problems. Finally a course that fits me.", author: "Pooja S.", detail: "NEET 2026, 655/720" },
    ],
    community: { title: "Join 6,000+ students in the Physics Room community", body: "Daily problems, study partners and Sunday AMAs.", cta: "Join free" },
    theme: { ...DEFAULT_THEME, ...LOOKS.spoon.theme },
    createdAt: now,
  };
  physics.category = "exam";
  physics.listed = true;
  physics.blocks = starterBlocks("exam", physics, { useSiteCopy: true });

  const music: Site = {
    id: randomUUID(),
    ownerId: meher.id,
    slug: "sursangam",
    name: "Sur Sangam",
    headline: "Find your *voice*, one raag at a time.",
    headlineHi: "हर राग के साथ, अपनी *आवाज़* पाइए।",
    bio: "Hindustani vocal training from Meher Kulkarni, a Kirana gharana disciple. Riyaz plans, taanpura drones and weekly live feedback on your recordings.",
    creator: { name: "Meher Kulkarni", title: "Kirana gharana · 14 yrs performing", rating: 4.8 },
    stats: { learners: 5200, rating: 4.8, results: 140, resultsLabel: "Gandharva exam passes" },
    live: [{ id: randomUUID(), title: "Raag Yaman Intensive", startsOn: "2026-11-08", schedule: "Sat & Sun · 7:00 am IST · 4 weeks", seatsLeft: 8 }],
    quotes: [
      { id: randomUUID(), text: "Six months of riyaz with Meher ji did more than three years of YouTube.", author: "Ananya D.", detail: "Pune" },
      { id: randomUUID(), text: "The recording feedback is so specific. I finally hear my own sur.", author: "Karthik R.", detail: "Bengaluru" },
    ],
    community: { title: "Morning riyaz circle, every day at 6 am", body: "Sing along with 800+ learners on a shared taanpura drone.", cta: "Join the circle" },
    theme: { ...DEFAULT_THEME, preset: "rosewood", accent: "#b23a48", accent2: "#d9a05b", font: "classic", radius: 22, motion: "rich", grain: true },
    createdAt: now,
  };
  music.category = "music";
  music.listed = true;
  music.theme = { ...DEFAULT_THEME, ...LOOKS.salon.theme, custom: undefined };
  music.blocks = starterBlocks("music", music, { useSiteCopy: true });

  const course = (site: Site, c: Omit<Course, "id" | "siteId" | "createdAt" | "published">): Course => ({
    ...c,
    id: randomUUID(),
    siteId: site.id,
    published: true,
    createdAt: now,
  });

  const courses: Course[] = [
    course(physics, {
      slug: "mechanics-from-first-principles",
      title: "Mechanics from First Principles",
      summary: "Kinematics to rigid bodies, built from three ideas instead of fifty formulas.",
      priceInr: 3499,
      mrpInr: 5999,
      tag: "Bestseller",
      lessons: lessons(["Why vectors?", "Motion in 1D, honestly", "Projectiles without memorising", "Newton's laws as bookkeeping", "Friction intuition", "Work and energy", "Momentum and collisions", "Rotational dynamics: torque intuition"], 3, [0, 1, 3, 4]),
    }),
    course(physics, {
      slug: "electrostatics-sprint",
      title: "Electrostatics Sprint",
      summary: "Fields, potentials and capacitors in 14 tight lessons, ending with a JEE-level mock.",
      priceInr: 1499,
      mrpInr: 2499,
      tag: "New",
      lessons: lessons(["Charge and Coulomb", "Field lines that mean something", "Gauss's law shortcuts", "Potential as height", "Capacitors", "Sprint mock test"], 2),
    }),
    course(physics, {
      slug: "jee-advanced-problem-lab",
      title: "JEE Advanced Problem Lab",
      summary: "48 hard problems solved live, with the thinking process shown before the maths.",
      priceInr: 5999,
      mrpInr: 8999,
      tag: "Live + recorded",
      lessons: lessons(["How to read a hard problem", "Mechanics set A", "Mechanics set B", "Electromagnetism set", "Optics and modern physics", "Full mock review"], 1),
    }),
    course(music, {
      slug: "foundations-of-sur",
      title: "Foundations of Sur",
      summary: "Breath, posture and the seven swaras, with a daily 20-minute riyaz plan.",
      priceInr: 2499,
      mrpInr: 3999,
      tag: "Start here",
      lessons: lessons(["Finding Sa", "Breath for singing", "Alankars 1–5", "Sargam geet", "Your first recording"]),
    }),
    course(music, {
      slug: "raag-yaman",
      title: "Raag Yaman, Deeply",
      summary: "Chalan, pakad, a bandish and your first improvised aalap in Yaman.",
      priceInr: 3999,
      tag: "Popular",
      lessons: lessons(["Mood and time of Yaman", "Chalan and pakad", "Bandish: Eri aali piya bina", "Aalap structure", "Taans for beginners"], 2),
    }),
  ];

  const member = (creator: Creator, role: "coowner" | "editor" | "support"): Membership => ({
    id: randomUUID(),
    siteId: physics.id,
    creatorId: creator.id,
    role,
    addedBy: ishaan.id,
    createdAt: now,
  });

  const db: Dataset = {
    creators: [ishaan, meher, riya, karan, anita],
    sites: [physics, music],
    courses,
    enrollments: [],
    memberships: [member(anita, "coowner"), member(riya, "editor"), member(karan, "support")],
    invites: [],
    audit: [],
    learners: [],
    progress: [],
    files: [],
    announcements: [],
  };
  addDemoContent(db);
  return db;
}
