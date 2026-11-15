# Kalaa

Multi-tenant creator platform: every educator gets a branded storefront on their own subdomain or custom domain, edited live from the Brand studio.

## Run it

Needs Node 22+ and MongoDB 7+ installed locally (`brew install mongodb-community@7.0`). Kalaa uses transactions, which need a replica set, so it runs its own single-node one on port 27018 and leaves any mongod you already run alone.

```bash
npm install
cp .env.example .env.local     # the defaults work locally
npm run db:local               # terminal 1: local MongoDB replica set (stays running)
npm run dev                    # terminal 2: migrates, adds sample data, starts the app
```

`npm run dev` first runs `db:setup` (migrations plus sample data), so a fresh clone works with those three commands. Coming from the old JSON store? Run `npm run db:migrate && npm run db:import-json` **before** the first `npm run dev`, so your own accounts aren't shadowed by sample ones.

| URL | What it is |
| --- | --- |
| http://localhost:3000 | Platform landing page |
| http://localhost:3000/studio | Creator studio: sites, brand, courses, domain |
| http://thephysicsroom.localhost:3000 | Sample creator site (dark, luxe) |
| http://sursangam.localhost:3000 | Sample creator site (light, classic) |

Sign in at `/login` with any of these (the code is printed in the dev server log):

| Email | Role |
| --- | --- |
| `ishaan@example.com` | Owner of The Physics Room |
| `anita@example.com` | Co-owner of The Physics Room |
| `riya@example.com` | Editor on The Physics Room |
| `karan@example.com` | Support on The Physics Room |
| `meher@example.com` | Owner of Sur Sangam |

Any other email creates a new creator account.

**As a learner**, open a storefront (e.g. http://thephysicsroom.localhost:3000), click *Sign in* and use any email. The code is printed in the dev server log. Reserve a seat on a course, then confirm payment as `ishaan@example.com` or `anita@example.com` under *Reservations → Mark as paid*. The course then appears under *My courses*. The sample lessons point at one placeholder YouTube clip; replace them from *Courses → Edit*. Without an email provider configured, sign-in codes and invitation links are printed in the dev server log.

`*.localhost` resolves to your machine in Chrome, Firefox and Safari, so subdomains work with no setup. Data lives in the `kalaa_dev` database; `npm run db:reset` wipes and re-seeds it.

## How it fits together

- **Tenant routing** — [src/middleware.ts](src/middleware.ts) rewrites any non-platform host to `/sites/<host>/…`. [src/server/data/sites.ts](src/server/data/sites.ts) `getSiteByHost` resolves `<slug>.<root>` first, then an active custom domain.
- **Theme tokens** — [src/lib/theme.ts](src/lib/theme.ts) defines presets, fonts, accent, radius, hero layout, sections and language. `themeVars()` turns a theme into `--b-*` CSS variables, and every storefront style in [src/app/storefront.css](src/app/storefront.css) reads only those. Layout uses container queries, so the studio's mobile preview matches a real phone.
- **One renderer** — [src/components/storefront.tsx](src/components/storefront.tsx) has no hooks or server imports, so the live site (server) and the Brand studio preview (client) render the same components.
- **Custom domains** — [src/server/domains.ts](src/server/domains.ts) checks the creator's CNAME against `CNAME_TARGET`. With `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` set, verified domains are registered as Cloudflare for SaaS custom hostnames, which issue SSL. On Vercel, set `VERCEL_API_TOKEN` and `VERCEL_PROJECT_ID` instead and verified domains are added to the Vercel project. Names ending in `.localhost` skip DNS for local testing (try `learn.thephysicsroom.localhost`).
- **Sign-in** — [src/server/auth.ts](src/server/auth.ts) emails a 6-digit code ([src/server/mail.ts](src/server/mail.ts), via Resend when configured). Codes and session tokens are stored only as SHA-256 hashes. Each code expires in 10 minutes and locks after 5 wrong tries, and an email can request at most 5 codes per 15 minutes. Sessions last 30 days in an httpOnly cookie on the platform host only, so creator storefronts never receive it.
- **Roles** — [src/lib/roles.ts](src/lib/roles.ts) is the single source of truth, shared by the UI and the server. Owner (one per site), Co-owner, Editor (brand and courses) and Support (reservations and learner contacts). Each role has a rank, and you can only invite, change or remove people ranked below you, so only the owner manages co-owners and a co-owner manages editors and support.
- **Access checks** — studio pages call `requireSiteAccess(slug, permission)`: no role on the site is a 404, a role without the permission gets an explanation page. Every server action calls `assertSiteAccess` itself, because actions are public endpoints. Team rules in [src/server/team.ts](src/server/team.ts) run *inside* the database write, so someone removed a moment ago can't finish an action. Access is read from the database on every request, so removal takes effect immediately.
- **Invitations** — an invitation is bound to one email address and expires after 7 days. The link carries a random token (only its hash is stored), and accepting requires signing in with the invited address and pressing a button, so a forwarded link is useless and email scanners can't use it up. Limits: 15 pending per site, 20 invitation emails an hour, one resend a minute. The inviter also gets the link to share on WhatsApp.
- **Ownership transfer** — the owner can hand the site to a co-owner and stays on as a co-owner. Team changes are logged and shown to owners and co-owners.
- **Learner sign-in** — [src/server/learner-auth.ts](src/server/learner-auth.ts) uses the same emailed-code engine as the studio ([src/server/otp.ts](src/server/otp.ts)), but accounts, codes and sessions are scoped to one storefront. The same email on two creators' sites is two separate accounts, and a studio code never works on a storefront or the other way round. The cookie is host-only and is checked against the site on every request, so a session from one storefront is worthless on another. Codes are emailed under the creator's name, capped at 100 an hour per site, and the reply is the same whether or not an account exists.
- **Access to courses** — a learner can open every lesson of a course once an owner or co-owner marks their reservation as paid (matched by the verified email). Free-preview lessons are open to everyone. The lesson link is read on the server only after that check, so a locked lesson's material is never sent to the browser. Revoking a payment locks the course on the learner's next request. An unpublished course disappears from the storefront but stays open to people who paid. A course with paid learners can't be deleted.
- **Lesson material** — each lesson can carry one https link. YouTube and Vimeo links play inline in a sandboxed player, and any other link opens in a new tab. Other schemes (`javascript:`, `data:`) are rejected.
- **Storage** — MongoDB through [src/server/db](src/server/db), with queries in [src/server/data](src/server/data). Lesson files go through a `BlobStore` ([src/server/storage](src/server/storage)). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the layers and the reasons behind each choice.

## Database

| Command | What it does |
| --- | --- |
| `npm run db:local` | Starts the local replica set (port 27018, data in `.data/mongo`) |
| `npm run db:migrate` | Applies pending migrations |
| `npm run db:status` | Lists migrations and whether each is applied |
| `npm run db:setup` | Migrate and add sample data (what `npm run dev` runs first) |
| `npm run db:reset` | Drops the local database and rebuilds it |
| `npm run db:rollback` | Reverts the last migration (dev databases only) |
| `npm run db:new <name>` | Creates the next migration file |
| `npm run db:import-json` | Copies the old `.data/db.json` into MongoDB (safe to repeat) |
| `npm run db:check` | Concurrency tests of the data layer, against a dev database |
| `npm run check:sections` | Tests of the page-builder model (no database needed) |
| `npm run check:ai` | Tests of the AI draft path against a local stand-in API |

**Changing the data model:** write a migration, never edit a shipped one, and keep it compatible with the previous release (the old deployment keeps serving while the new one builds). Add fields and indexes first; remove old ones in a later release. `npm run db:new add_course_tags`, add it to `migrations/index.ts`, `npm run db:migrate`.

## Configuration

Every variable is documented in [.env.example](.env.example). Required: `MONGODB_URI`, `MONGODB_DB`, `NEXT_PUBLIC_ROOT_DOMAIN`. Production also needs email (`RESEND_API_KEY`, `MAIL_FROM`) and file storage (`STORAGE_DIR` on your own server, a Blob store on Vercel).

## Deploying to your own server

This is the production plan: one server behind Cloudflare, the same setup as Datsnip. The full plan, with decisions,
phases and costs, is [docs/DEPLOYMENT-PLAN.md](docs/DEPLOYMENT-PLAN.md). The server itself is configured by the private
`kalaa-infra` repo (Ansible + OpenTofu); nothing in this repo provisions servers.

What the app needs from that server:

| Need | How |
| --- | --- |
| Node 22, `npm ci`, `npm run db:migrate`, `npm run build`, `npm start` | `NEXT_PUBLIC_ROOT_DOMAIN` must be set **at build time** too: it is inlined into the middleware |
| MongoDB 7+ as a replica set (transactions need one) | A single-node replica set on the same machine, bound to `127.0.0.1`, with auth |
| Files | `STORAGE_DRIVER=local` and `STORAGE_DIR` outside the app's checkout (e.g. `/var/lib/kalaa/files`), backed up with the database |
| Real client IPs for rate limits | `CLIENT_IP_HEADER=cf-connecting-ip`, only when the firewall admits nothing but Cloudflare |
| Scheduled publishing | Call `GET /api/cron/publish` with `Authorization: Bearer $CRON_SECRET` every 5 minutes (a systemd timer) |
| Hosts | Cloudflare DNS: apex, `www` and wildcard `*` for storefronts, plus `edge` as `CNAME_TARGET`. Creators' own domains go through Cloudflare for SaaS (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`) |
| Uptime | `/api/health` |

Before merging to `main`, run what CI runs: `npm run typecheck && npm run check:sections && npm run build`.

## Deploying to Vercel

The alternative: managed hosting, more expensive once backups and crons are needed.


One-time setup:

1. **Project.** Import the repo in Vercel. `vercel.json` already sets the build command (`npm run vercel-build`, which migrates the database and then builds) and the Mumbai region.
2. **Database.** Add *MongoDB Atlas* from the Vercel Marketplace and connect it to the project for Production and Preview. It sets `MONGODB_URI`. Then add `MONGODB_DB` yourself: `kalaa` for Production, `kalaa_preview` for Preview. Atlas gives you backups and the replica set transactions need; pick an M10+ cluster before real learners arrive, as the free tier has no backups.
3. **Files.** Storage → Create → Blob → **Private**, connect it to the project. It sets `BLOB_READ_WRITE_TOKEN` (needed for browser uploads).
4. **Email.** Verify the `kalaa.so` domain in Resend, then set `RESEND_API_KEY` and `MAIL_FROM`.
5. **Domains.** Add `kalaa.so`, `www.kalaa.so` and the wildcard `*.kalaa.so` to the project (the wildcard needs the domain on Vercel nameservers). Set `NEXT_PUBLIC_ROOT_DOMAIN=kalaa.so`, `CNAME_TARGET=cname.vercel-dns.com`, and for creators' own domains `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`.
6. **Move existing data** (only if you have local data worth keeping): `MONGODB_URI=<atlas uri> MONGODB_DB=kalaa npm run db:import-json`. Production is never seeded with sample data.

After that every push to `main` deploys: migrations run first, and if one fails the build stops and the live site is untouched. Preview deployments (pull requests) use the `kalaa_preview` database; run `MONGODB_URI=<atlas uri> MONGODB_DB=kalaa_preview npm run db:seed` once to give previews sample data. `/api/health` reports database reachability for uptime monitors.

Rolling back a bad release: promote the previous deployment in Vercel. Because migrations only add, the old code keeps working against the new schema.

## Not built yet

- **Per-user display names.** Teammates are named from their email address, and there is no profile page.
- **Per-site or per-course permissions.** Roles apply to the whole site.
- **Per-IP abuse limits.** Rate limits are shared across servers (in MongoDB) but are per email and per site, not per IP address.
- **Online payments.** Payment is confirmed by hand today (UPI or bank transfer arranged over WhatsApp). Razorpay checkout would replace the "Mark as paid" step.
- **Content protection.** Lesson links are not DRM. Anyone with a link can share it, so use unlisted videos. Signed, expiring video URLs (Mux or Cloudflare Stream) are the real fix.
- **Progress tracking, certificates and learner profiles.**
- **Live classes, the AI doubt assistant, the native app.**
- Editing live batches, student stories and stats from the studio (they're seeded for now).

## Page builder and site editor

Open `/editor/<slug>` (the studio's "Site editor" link). The page is a list of blocks (`src/lib/blocks.ts` declares each block's fields once; the inspector forms and server-side validation both come from that). Drag sections on the canvas or in Layers, click text to edit it in place (⌘I sets accent words), change looks, colours, fonts, motion and backdrop in Design, and publish. Undo/redo (⌘Z), draft recovery and device previews are built in. The hero orb and aurora are raw WebGL shaders (`src/components/shaders.tsx`). Learners get lesson progress (mark complete, resume, studio progress column).

### Brand kit, media library and custom sections

- **Media library** (editor → Media): upload PNG, JPG, WebP, GIF or SVG (8 MB each, 300 MB per site). Files are checked by their real contents; SVGs with scripts are refused. Images are public, served at `/api/media/<id>`, and an image on the published site can't be deleted. Code: `src/server/media.ts`.
- **Site tab** (editor → right panel): logo (and a dark-background variant), favicon, share image, colour suggestions drawn from the logo, header menu (automatic or your own links) and main button, announcement bar, footer links and socials. Code: `src/lib/chrome.ts`, `src/components/site-settings.tsx`.
- **Custom sections** (editor → Add → Build your own): a row of 1–4 columns holding elements: heading, text, image, button, video, embed (Google Maps/Forms, Calendly, Tally), list, divider, space, countdown, icon + text, WhatsApp button. Each section has width, spacing, alignment, a colour/gradient/image background, light or dark text, and per-device visibility. Click text on the page to edit it in place. Save a section as **My sections** to insert copies later. The model and its validator are `src/lib/custom.ts`; nothing in it accepts raw HTML or CSS.
- **Pages:** the page menu in the editor's top bar switches between Home, any number of extra pages (up to 12, each at `/<address>` with its own title and search description, optionally in the header menu) and **Course pages**. Fixed addresses (`login`, `courses`, ...) are reserved. Code: `src/lib/pages.ts`, `src/app/sites/[site]/[page]`.
- **Course pages template:** one design for every course. A locked "Course details" block (title, lessons, reserve form) holds its place; sections added above or below it appear on every course page, where "Course facts" shows whichever course is open.
- **Elements bound to real data:** *Course cards* (published courses, filter by badge), *Course facts* and *Live number* (students enrolled, courses, lessons, hours; hidden until above zero). A course can have a **seat limit**; "seats left" counts every reservation, paid or not. Code: `src/server/data/public.ts`.
- **What visitors may see of a course:** the storefront's client components only ever receive `PublicCourse` (`src/lib/types.ts`): no lesson links, no files. Locked lessons stay locked in the page source.
- **Contact forms and leads:** add a *Contact form* element (Add → Build your own → Contact form). Visitors' answers go to **Studio → Leads** (status, search, CSV for owners and co-owners) and are emailed to the owner and co-owners. What a form asks is read from the *published* site, never from the browser. Spam control: a hidden field, a minimum fill-in time, and limits per address (8/hour), per email (3/day) and per site (300/hour). Code: `src/server/leads.ts`, `src/app/sites/[site]/lead-actions.ts`.
- **Pop-up, announcement bar and tracking** (editor → Site tab): a pop-up that appears after a few seconds (once, daily or every visit, remembered in the browser, never on sign-in or lesson pages), and Google Analytics / Meta Pixel IDs. Only a validated ID is ever placed on the page; no free-form scripts. A cookie notice, where the law requires one, is the site owner's job.
- **History and scheduled publishing** (editor top bar → *History* and *Schedule*): every publish is kept (the last 30). *Restore* loads an old version as an unpublished draft (⌘Z undoes it). *Schedule* holds the current draft to go live at a set time. Scheduled publishes are applied by `/api/cron/publish` (Vercel Cron, every 5 minutes; set `CRON_SECRET`) and also whenever a teammate opens the editor. On Vercel's Hobby plan crons run at most once a day. Code: `src/server/publish.ts`.
- **AI first draft** (editor → Add → *Write my page with AI*, shown only when `ANTHROPIC_API_KEY` is set): the teacher describes their teaching; Claude (`claude-opus-5-5`, override with `ANTHROPIC_MODEL`) writes only words, as strict JSON, which are validated and merged into the sections the page already has. It is told never to invent results or numbers. Limited to 6 drafts per site per hour. Code: `src/server/ai.ts`, `src/lib/ai-copy.ts`.
- `npm run check:ai` tests the AI path against a local stand-in for the API (no key, no cost).
- `npm run check:sections` runs the model's checks (hostile input, limits, layouts, pages, templates, public course shape) with no database.

## Templates, home page and demo accounts

- **Seven industry templates** (`src/lib/templates.ts`): exam coaching, skills and careers, language, music and arts, fitness, school and tuition, creator and hobby. Each has its own layout, look and wording. A teacher picks one when creating a site, and can swap in the editor (layout, or layout plus look). New sites get placeholder wording only, with no invented numbers or testimonials.
- **Home page** (`src/app/page.tsx`) sells the whole business product, and tags each capability Live, Listings today or Coming soon. **Explore** (`/explore`) lists teachers by category, with search.
- **Payments:** teachers add a UPI ID under *Settings*. After reserving a seat, students get a button that opens their UPI app with the amount filled in. The teacher still confirms payment by hand. Razorpay would replace that step.
- **Demo content** (`src/server/db/seed/demo.ts`): five extra demo teachers, and a demo student. `npm run db:seed` adds whatever is missing to a development database, and it never changes your own sites. It refuses to run against any database not named `*_dev`, `*_test` or `*_preview`.

### Try it as a student
1. Start the server and open http://thephysicsroom.localhost:3000
2. Click **Sign in**, enter `demo.learner@example.com`, and click **Email me a code**.
3. Copy the 6-digit code from the terminal running `npm run dev`.
4. Sign in. **My courses** shows two paid courses with progress saved, and one reservation waiting for payment.

Other demo teachers (sign in to the studio at `/login` with these): `divya@`, `kavya@`, `arjun@`, `sunita@`, `meenakshi@example.com`. See `docs/USE-CASES.md` for what is built and what is not.

## Lessons and attachments

Courses are edited row by row (`src/components/lesson-editor.tsx`): title, minutes, a free-preview toggle, a video link, drag to reorder, or paste a list. Each lesson can carry up to 10 files (PDF, Word, PowerPoint, Excel, text, CSV, images, ZIP; 15 MB each, 500 MB per site). `src/server/files.ts` checks every upload by its real contents, not its name. In production the browser uploads straight to a private Vercel Blob store (Vercel functions accept at most 4.5 MB per request) and the server then reads the bytes back to verify them; locally the files sit under `.data/files`. `src/app/sites/[site]/files/[id]/route.ts` serves a file only to the people allowed to see that lesson. Files removed from a lesson are deleted from storage when the course is saved, and uploads that were never attached are cleared after a day.

## Students and announcements

`/studio/<slug>/students` lists everyone who has signed in or reserved a seat (one row per email), with per-course lesson progress, search and status/course filters. Owners and co-owners can download the list as CSV and email all paid students of a course: send yourself a test first, then confirm the send. Limits: 500 recipients, 5 announcements per site per day, 3000 characters. Mail goes out as "Teacher via Kalaa" with the teacher as reply-to. In dev the mail prints to the terminal. Support staff can see the list but not email or export it.
