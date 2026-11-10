// Checks for the page builder's pure model (lib/custom.ts, lib/chrome.ts, lib/media.ts). No database needed:
//   npm run check:sections
import { sanitizeBlocks, setPath } from "@/lib/blocks";
import { applyCopy, parseCopy } from "@/lib/ai-copy";
import { autoNavLinks, sanitizeChrome } from "@/lib/chrome";
import { COURSE, HOME, MAX_PAGES, RESERVED_SLUGS, blocksOf, copyPage, defaultCourseTemplate, newPage, sanitizeCourseTemplate, sanitizePages, splitTemplate, uniqueSlug, withBlocks } from "@/lib/pages";
import { publicCourse, type Course } from "@/lib/types";
import { ELEMENT_TYPES, STARTERS, addEl, allowedEmbed, countElements, countdownTarget, duplicateEl, emptyCustom, firstText, locate, moveEl, newEl, removeEl, sanitizeCustom, sectionClasses, setElProp, withLayout } from "@/lib/custom";
import { dropForeignMedia, mediaRefs, safeImageUrl } from "@/lib/media";

let failures = 0;
const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};

// ---- hostile input to a custom section ----
const bad = sanitizeCustom({
  layout: "9-9",
  design: { width: "huge", pad: "<script>", bg: { kind: "image", color: "red; background:url(x)", image: "javascript:alert(1)", overlay: 9999, angle: -50 }, text: "pink" },
  cols: [[
    { type: "heading", props: { text: "x".repeat(500), size: "url(evil)" } },
    { type: "video", props: { url: "https://evil.example/v.mp4" } },
    { type: "embed", props: { url: "https://evil.example/maps/embed" } },
    { type: "embed", props: { url: "https://www.google.com/maps/embed?pb=abc" } },
    { type: "embed", props: { url: "https://calendly.com/" } },
    { type: "whatsapp", props: { number: "+91 98765-43210" } },
    { type: "whatsapp", props: { number: "abc" } },
    { type: "image", props: { src: "data:image/svg+xml,<svg onload=alert(1)>", href: "javascript:alert(1)" } },
    { type: "script", props: { text: "x" } },
    { type: "button", props: { label: "<img src=x onerror=alert(1)>", href: "//evil.example" } },
    { type: "countdown", props: { time: "25:99", date: "garbage" } },
    ...Array.from({ length: 30 }, () => ({ type: "spacer", props: {} })),
  ]],
});
ok("unknown layout falls back to one column", bad.layout === "1");
ok("design values are enums and clamped", bad.design.width === "contained" && bad.design.pad === "md" && bad.design.text === "auto" && bad.design.bg.overlay === 85 && bad.design.bg.angle === 0);
ok("background colour and image rejected", bad.design.bg.color === "#1d2433" && bad.design.bg.image === "");
const col = bad.cols[0];
ok("a column holds at most 12 submitted elements", col.length <= 12, String(col.length));
const of = (t: string) => col.filter((e) => e.type === t);
ok("heading text capped", String(of("heading")[0].props.text).length === 160);
ok("heading size is an enum", of("heading")[0].props.size === "l");
ok("video from another host dropped", of("video")[0].props.url === "");
const embeds = of("embed").map((e) => e.props.url);
ok("embed allow-list", embeds[0] === "" && String(embeds[1]).startsWith("https://www.google.com/maps/embed") && embeds[2] === "", JSON.stringify(embeds));
const wa = of("whatsapp").map((e) => e.props.number);
ok("whatsapp number is digits only", wa[0] === "919876543210" && wa[1] === "", JSON.stringify(wa));
ok("data: image and javascript: link dropped", of("image")[0].props.src === "" && of("image")[0].props.href === "");
ok("unknown element type dropped", !col.some((e) => (e.type as string) === "script"));
ok("protocol-relative link dropped", of("button")[0].props.href === "");
ok("countdown time and date repaired", of("countdown")[0].props.time === "00:00" && of("countdown")[0].props.date === "2026-12-01");
ok("element ids are unique", new Set(col.map((e) => e.id)).size === col.length);
ok("a whole section holds at most 40 elements", countElements(sanitizeCustom({ layout: "1-1-1-1", cols: Array.from({ length: 4 }, () => Array.from({ length: 12 }, () => ({ type: "spacer", props: {} }))) })) === 40);

// ---- layout changes and editing operations ----
const p = sanitizeCustom({ layout: "1-1-1", cols: [[{ type: "heading", props: {} }], [{ type: "text", props: {} }], [{ type: "button", props: {} }]] });
ok("3 to 1 columns keeps every element", withLayout(p, "1").cols[0].length === 3);
ok("3 to 4 columns adds an empty one", withLayout(p, "1-1-1-1").cols.length === 4 && countElements(withLayout(p, "1-1-1-1")) === 3);
ok("3 to 2 merges the extra into the last", withLayout(p, "1-2").cols[1].map((e) => e.type).join() === "text,button");
const id = p.cols[0][0].id;
const added = addEl(p, 2, newEl("divider"));
ok("addEl appends and leaves the original alone", added.cols[2].length === 2 && p.cols[2].length === 1);
const moved = moveEl(added, id, { col: 2 });
ok("moveEl to another column", moved.cols[0].length === 0 && moved.cols[2].at(-1)?.id === id);
const dup = duplicateEl(p, id);
ok("duplicateEl places a new id after the original", dup.id !== null && dup.id !== id && dup.props.cols[0][1].id === dup.id);
ok("removeEl", locate(removeEl(p, id), id) === null);
ok("setElProp", setElProp(p, id, "text", "Hello").cols[0][0].props.text === "Hello");
ok("moveEl with an unknown id does nothing", moveEl(p, "nope", { dir: -1 }) === p);

// ---- the block pipeline and inline editing paths ----
const blocks = sanitizeBlocks([{ type: "custom", id: "bk_test1", props: p }, { type: "hero", props: {} }]);
ok("sanitizeBlocks keeps a custom section", blocks[0].type === "custom" && (blocks[0].props as { cols: unknown[] }).cols.length === 3);
const edited = setPath(blocks[0].props, "cols.1.0.props.text", "Edited inline") as { cols: { props: { text: string } }[][] };
ok("setPath reaches through nested arrays", edited.cols[1][0].props.text === "Edited inline" && Array.isArray(edited.cols[1]) && edited.cols.length === 3);

for (const s of STARTERS) {
  const built = s.build();
  const strip = (x: typeof built) => JSON.stringify(x.cols.map((c) => c.map((e) => [e.type, e.props])));
  ok(`starter "${s.id}" survives its own validator`, strip(sanitizeCustom(built)) === strip(built));
}
ok("every element type builds with defaults", ELEMENT_TYPES.every((t) => newEl(t).type === t));
ok("section classes", sectionClasses(emptyCustom()).includes("cs-p-md"));
ok("firstText finds the first heading", firstText(STARTERS[1].build()).startsWith("Learn the way"));
ok("countdown dates are Indian Standard Time", countdownTarget("2026-12-01", "19:00") === Date.parse("2026-12-01T13:30:00Z"));
ok("embeds must be https", allowedEmbed("http://calendly.com/x") === "");

// ---- site chrome and library images ----
const A = "64a0310b-234c-4940-97e2-e96d22c7b761";
const B = "99999999-9999-4999-8999-999999999999";
const chrome = sanitizeChrome({
  brand: { logo: `/api/media/${A}`, logoDark: "javascript:alert(1)", favicon: "http://insecure.example/x.png", share: "data:image/png;base64,AAA" },
  nav: { auto: false, links: [{ label: "Ok", href: "#faq" }, { label: "Bad", href: "javascript:alert(1)" }, { label: "", href: "/x" }, { label: "Rel", href: "//evil.example" }, ...Array.from({ length: 20 }, (_, i) => ({ label: `L${i}`, href: "/p" }))], ctaHref: "javascript:x" },
  announcement: { enabled: true, text: "   ", href: "https://ok.example" },
  footer: { socials: [{ kind: "instagram", url: "https://instagram.com/a" }, { kind: "instagram", url: "javascript:1" }, { kind: "email", url: "A@B.in" }, { kind: "nope", url: "https://x.y" }, { kind: "email", url: "bad" }] },
});
ok("chrome keeps a library logo, drops js/http/data images", chrome.brand.logo === `/api/media/${A}` && chrome.brand.logoDark === "" && chrome.brand.favicon === "" && chrome.brand.share === "");
ok("chrome drops unsafe and half-filled links", chrome.nav.links.every((l) => l.label && !l.href.startsWith("javascript") && !l.href.startsWith("//")) && chrome.nav.ctaHref === "/#courses");
ok("a blank announcement is not enabled", chrome.announcement.enabled === false);
ok("socials are validated per network", chrome.footer.socials.map((s) => `${s.kind}:${s.url}`).join() === "instagram:https://instagram.com/a,email:a@b.in");
ok("chrome accepts empty and junk input", sanitizeChrome(undefined).nav.auto === true && sanitizeChrome("junk").footer.showBuiltWith === true);
const page = { blocks: sanitizeBlocks([{ type: "hero", props: { imageUrl: `/api/media/${B}` } }, { type: "about", props: { imageUrl: `/api/media/${A}` } }]), chrome };
const cleaned = dropForeignMedia(page, new Set([A]));
ok("another site's library image is blanked", mediaRefs(page).size === 2 && mediaRefs(cleaned).size === 1 && (cleaned.blocks[0].props as Record<string, unknown>).imageUrl === "");
ok("safeImageUrl", safeImageUrl("https://a.b/c.png") !== "" && safeImageUrl("http://a.b/c.png") === "" && safeImageUrl("/api/media/not-a-uuid") === "" && safeImageUrl("https://u:p@a.b/c.png") === "");

// ---- pages ----
const pages = sanitizePages([
  { title: "About us", slug: "About Us!", inMenu: true, blocks: [{ type: "hero", props: {} }, { type: "coursecore", props: {} }] },
  { title: "Login", slug: "login" },
  { title: "Courses", slug: "courses" },
  { title: "About us again", slug: "about-us" },
  { title: "   ", slug: "blank-title" },
  { title: "x".repeat(200), slug: "../../etc/passwd" },
  ...Array.from({ length: 30 }, (_, i) => ({ title: `P${i}`, slug: `p-${i}` })),
]);
ok("pages are capped", pages.length <= MAX_PAGES && pages.length >= 10, String(pages.length));
ok("slug is cleaned", pages[0].slug === "about-us", pages[0].slug);
ok("reserved addresses are never used", pages.every((p) => !RESERVED_SLUGS.has(p.slug)), pages.slice(1, 3).map((p) => p.slug).join());
ok("addresses are unique", new Set(pages.map((p) => p.slug)).size === pages.length);
ok("addresses are plain", pages.every((p) => /^[a-z0-9][a-z0-9-]*$/.test(p.slug)));
ok("a page with no title is dropped, long titles are cut", !pages.some((p) => p.slug === "blank-title") && pages.every((p) => p.title.length <= 60));
ok("course details can't sneak onto a normal page", pages[0].blocks.length === 1 && pages[0].blocks[0].type === "hero");
ok("page ids are unique and never home/course", new Set(pages.map((p) => p.id)).size === pages.length && pages.every((p) => p.id !== HOME && p.id !== COURSE));
ok("uniqueSlug avoids taken and reserved", uniqueSlug("login", new Set()) === "login-page" && uniqueSlug("a", new Set(["a"])) === "a-2");

const messy = sanitizeCourseTemplate([{ type: "hero", props: {} }, { type: "coursecore", props: {} }, { type: "coursecore", props: {} }, { type: "faq", props: {} }]);
ok("course template keeps exactly one course-details block, in place", messy.filter((b) => b.type === "coursecore").length === 1 && messy.map((b) => b.type).join() === "hero,coursecore,faq");
ok("a template without it gets one at the top", sanitizeCourseTemplate([{ type: "faq", props: {} }])[0].type === "coursecore" && sanitizeCourseTemplate(undefined).length === 1);
const split = splitTemplate(messy);
ok("template splits around the fixed block", split.before.map((b) => b.type).join() === "hero" && split.after.map((b) => b.type).join() === "faq");
ok("default template is just the fixed block", splitTemplate(undefined).before.length === 0 && splitTemplate(undefined).after.length === 0 && defaultCourseTemplate().length === 1);

const np = newPage("Contact", new Set(["contact"]));
ok("newPage has content and a free address", np.slug === "contact-2" && np.blocks.length === 1 && np.blocks[0].type === "custom");
const cp = copyPage(np, new Set(["contact", "contact-2"]));
ok("copyPage gives fresh ids and its own address", cp.id !== np.id && cp.blocks[0].id !== np.blocks[0].id && cp.slug !== np.slug && cp.title === "Contact copy");
const doc = { blocks: [], pages: [np], courseTemplate: defaultCourseTemplate() };
ok("blocksOf / withBlocks per page", blocksOf(doc, np.id)[0].id === np.blocks[0].id && withBlocks(doc, np.id, []).pages[0].blocks.length === 0 && withBlocks(doc, COURSE, []).courseTemplate.length === 0 && withBlocks(doc, HOME, []).pages === doc.pages);
const nav = autoNavLinks([], "en", [{ id: "a", title: "About", slug: "about", inMenu: true }, { id: "b", title: "Hidden", slug: "hidden", inMenu: false }]);
ok("menu lists only pages marked for it", nav.length === 1 && nav[0].href === "/about");

// ---- what visitors may see of a course ----
const course: Course = { id: "c1", siteId: "s1", slug: "x", title: "T", summary: "S", priceInr: 100, lessons: [{ title: "L1", minutes: 5, free: false, url: "https://youtube.com/watch?v=SECRET", files: [{ id: "f", name: "n", size: 1, type: "t" }] }], published: true, createdAt: "now", seats: 10 };
const pub = publicCourse(course, 4);
ok("public course carries no lesson link, file, site id or draft state", !JSON.stringify(pub).includes("SECRET") && !("siteId" in pub) && !("published" in pub) && !("files" in pub.lessons[0]) && pub.seatsLeft === 4);
ok("seatsLeft is omitted when there is no limit", !("seatsLeft" in publicCourse({ ...course, seats: undefined })));

// ---- data-bound elements ----
const bound = sanitizeCustom({ layout: "1", cols: [[{ type: "courses", props: { limit: 999, tag: "x".repeat(99) } }, { type: "statistic", props: { kind: "ssn", label: "x".repeat(200), suffix: "<script>" } }, { type: "coursefacts", props: {} }]] });
ok("bound elements validate", bound.cols[0][0].props.limit === 12 && String(bound.cols[0][0].props.tag).length === 24 && bound.cols[0][1].props.kind === "students" && String(bound.cols[0][1].props.label).length === 60 && String(bound.cols[0][1].props.suffix).length <= 4 && bound.cols[0][2].props.price === true);

// ---- pop-up and tracking ----
const tracked = sanitizeChrome({ analytics: { ga: "g-abc123xyz9", meta: "123456789012345" }, popup: { enabled: true, title: "Hi", text: "", delay: 999, repeat: "sometimes", buttonLabel: "Go", buttonHref: "javascript:alert(1)" } });
ok("analytics IDs are normalised", tracked.analytics.ga === "G-ABC123XYZ9" && tracked.analytics.meta === "123456789012345");
for (const bad of ["G-ABC'); alert(1);//", "UA-1234-1", "<script>", "G-", "G-ABC 123", "https://evil.example/x.js"]) ok(`GA ID rejects ${JSON.stringify(bad)}`, sanitizeChrome({ analytics: { ga: bad } }).analytics.ga === "");
for (const bad of ["12345", "1234567890'); x();//", "abc", "1".repeat(30)]) ok(`Meta Pixel ID rejects ${JSON.stringify(bad)}`, sanitizeChrome({ analytics: { meta: bad } }).analytics.meta === "");
ok("pop-up delay is clamped, repeat is an enum, unsafe link dropped", tracked.popup.delay === 60 && tracked.popup.repeat === "daily" && tracked.popup.buttonHref === "");
ok("a pop-up with no words is not enabled", sanitizeChrome({ popup: { enabled: true } }).popup.enabled === false && tracked.popup.enabled === true);

// ---- AI copy: whatever the model says, only validated words reach the page ----
const reply = { headline: "Learn *better*", intro: "I teach physics.", about: "A teacher.", featuresTitle: "Why us", features: [{ icon: "★", title: "One", text: "First" }, { icon: "◎", title: "Two", text: "Second" }, { title: "No text" }], faqTitle: "FAQ", faq: [{ q: "Q1?", a: "A1" }, { q: "Q2?", a: "A2" }], ctaHeadline: "Join", ctaBody: "Now", ctaLabel: "Go" };
ok("a fenced reply with chatter around it is parsed", parseCopy("Sure!\n```json\n" + JSON.stringify(reply) + "\n```\nHope that helps.")?.headline === "Learn *better*");
ok("items missing words are dropped, missing icons get a default", parseCopy(JSON.stringify(reply))!.features.length === 2 && parseCopy(JSON.stringify({ ...reply, features: [{ title: "T", text: "x" }, { title: "U", text: "y" }] }))!.features[0].icon === "✦");
ok("not JSON, no headline or almost empty is no draft", parseCopy("I can't help") === null && parseCopy(JSON.stringify({ ...reply, headline: "" })) === null && parseCopy(JSON.stringify({ headline: "Only a headline" })) === null && parseCopy("{broken json") === null);
const wild = parseCopy(JSON.stringify({ ...reply, headline: "x".repeat(900), intro: { nested: true }, about: 5, ctaLabel: "<script>alert(1)</script>".repeat(5), features: "nope" }))!;
ok("long values are cut and wrong types ignored", wild.headline.length === 120 && wild.intro === "" && wild.about === "" && wild.features.length === 0 && wild.ctaLabel.length <= 30);
const aiPage = sanitizeBlocks([{ type: "hero", props: { imageUrl: "https://x.y/z.png", ctaHref: "#live" } }, { type: "courses", props: {} }, { type: "features", props: {} }, { type: "features", props: { title: "second stays" } }, { type: "faq", props: {} }, { type: "cta", props: {} }, { type: "about", props: {} }]);
const merged = applyCopy(aiPage, parseCopy(JSON.stringify(reply))!);
const byType = (t: string, n = 0) => merged.filter((b) => b.type === t)[n].props as Record<string, unknown>;
ok("copy is written into hero, why-us, about, questions and call to action", byType("hero").headline === "Learn *better*" && (byType("features").items as unknown[]).length === 2 && byType("about").body === "A teacher." && (byType("faq").items as unknown[]).length === 2 && byType("cta").ctaLabel === "Go");
ok("layout, links, images and other sections stay as they were", byType("hero").imageUrl === "https://x.y/z.png" && byType("hero").ctaHref === "#live" && merged.map((b) => b.type).join() === aiPage.map((b) => b.type).join() && byType("features", 1).title === "second stays");
const thin = applyCopy(aiPage, { ...parseCopy(JSON.stringify(reply))!, features: [], ctaLabel: "", about: "" });
ok("empty parts of a draft never wipe existing content", (thin.find((b) => b.type === "features")!.props.items as unknown[]).length === 4 && thin.find((b) => b.type === "cta")!.props.ctaLabel === aiPage.find((b) => b.type === "cta")!.props.ctaLabel);

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exitCode = failures ? 1 : 0;
