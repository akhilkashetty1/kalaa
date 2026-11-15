# Kalaa architecture

One Next.js app (App Router) and MongoDB. It runs in either of two ways, with the same code:

- **Own server** (the production plan, see [DEPLOYMENT-PLAN.md](DEPLOYMENT-PLAN.md)): Cloudflare -> Caddy -> `next start`,
  MongoDB as a single-node replica set on the same machine, files on its disk under `STORAGE_DIR`, scheduled publishing
  from a systemd timer. Infrastructure lives in the private `kalaa-infra` repo.
- **Vercel**: MongoDB Atlas, a private Vercel Blob store for files, Vercel Cron. Request-driven, so it scales to zero
  and deploys with `git push` (README -> Deploying to Vercel).

## Layers

```
src/
  app/          routes and server actions. Thin: parse input, call server/, render.
  components/   React UI. Never imports server/.
  lib/          pure code shared by server and client: types, roles, themes, blocks, config. No I/O.
  server/       everything with side effects. Every file starts with `import "server-only"`.
    db/           MongoDB: client, collections, transactions, migrations, seed
    data/         queries and writes per area (sites, courses, enrollments, progress, students)
    storage/      BlobStore: local disk (dev, own server) | private Vercel Blob (Vercel)
    auth.ts, learner-auth.ts, otp.ts, team.ts, files.ts, announce.ts, domains.ts, mail.ts ...
  middleware.ts tenant routing (host -> /sites/<host>)
scripts/        db.ts (migrate, seed, import...), local-mongo.sh, check-data-layer.ts
```

Dependency direction: `app, components -> server -> lib`. `lib` imports nothing from the others, and
`server-only` makes the build fail if a client component ever imports `server/`.

## Decisions

| Decision | Why |
| --- | --- |
| **MongoDB**, one document per record, ids are UUID strings stored as `_id` | Storefront pages, themes and page-builder blocks are nested documents that are read whole. Ids stay strings so they cross the server/client boundary unchanged. |
| **Official `mongodb` driver**, no ODM | The data layer is small and typed through `collections.ts`. An ODM would add a second schema language. Server-side `$jsonSchema` validators (migration 0002) guard the core fields. |
| **Schema in migrations**, not in code | Indexes, validators and data fixes are versioned files applied by `npm run db:migrate`, locked so two deploys can't run them at once. |
| **Unique indexes enforce invariants** | One account per email, one site per slug or custom domain, one learner per email per site, one membership per person per site. Races end in a duplicate-key error, never two records. |
| **Transactions for multi-record rules** | Team changes, payment confirmation, course delete and announcements run in a transaction after `lockSite()`, so a removed teammate can't finish an action they started. Needs a replica set (Atlas always is). |
| **Atomic single-document updates** for counters | OTP attempts, rate limits and lesson progress use `$inc`, `$addToSet` and upserts, so parallel requests can't overwrite each other. |
| **TTL indexes** | Sessions, sign-in codes and rate-limit windows expire by themselves. Expiry is also checked in queries because TTL runs about once a minute. |
| **Rate limits in MongoDB** | Shared by every serverless instance. No Redis to run. |
| **Files behind our download routes**: disk on an own server, private Vercel Blob on Vercel | Lesson files are paid content, so the store has no public URLs. On Vercel, uploads go browser -> Blob directly (functions accept at most 4.5 MB), then we verify the bytes and record them. On an own server they go through our upload route. |
| **Client IP from a configured header** (`src/server/client-ip.ts`) | Per-IP limits need the visitor's address, and which header is trustworthy depends on the proxy in front. Behind Cloudflare, `CLIENT_IP_HEADER=cf-connecting-ip`; otherwise the first `X-Forwarded-For` entry. |
| **Multi-tenancy by host** | Middleware rewrites any non-platform host to `/sites/<host>`. Tenant data is always filtered by `siteId`. |
| **Two environments, two databases** | `kalaa` (production), `kalaa_preview`, `kalaa_dev`. Seeding refuses any name not ending `_dev`, `_test` or `_preview`. |

## Request flow

Browser -> Cloudflare -> Caddy (own server) or Vercel edge -> `middleware.ts` (host routing) -> page or action -> `server/data/*` -> MongoDB.
Files, own server: browser -> `/api/studio/upload/start` (checks) -> `/api/studio/upload` (verifies, writes to disk, records).
Files, Vercel: browser -> `/api/studio/upload/start` (checks) -> Blob (direct) -> `/api/studio/upload/complete` (verifies, records).
Learner downloads: `/sites/<host>/files/<id>` -> `canDownload()` -> stream from the store with `no-store`.

## Rules for new code

- Touch MongoDB only from `src/server/`. Add queries to `server/data/<area>.ts`.
- Need two writes to succeed together? `withTransaction`, `lockSite(tx, siteId)`, pass `session` to every call, and send email after it returns.
- Changing the shape of stored data? Write a migration (`npm run db:new <name>`). It must run on the old and new code, because the old deployment keeps serving while the new one builds. Add first, remove in a later release.
- A new unique rule belongs in an index, not only in code.

## Mobile app API (`/api/app/v1`)

JSON API for the mobile apps and the installable web app. The tenant is the request's `Host` header, so an app talks to the teacher's own address like a browser does. A learner signs in with the same emailed code, then sends `Authorization: Bearer <token>`; the token is a `learner_sessions` row scoped to one site (only its hash is stored), so a token from one school never works on another.

| Route | Purpose |
|---|---|
| `GET site` | Name, look, brand kit, announcement, public courses. Changing these in Studio changes the app with no store release. |
| `POST auth/code`, `POST auth/verify`, `POST auth/logout` | Emailed code, exchange for a token, revoke. Rate limited per IP and per site. |
| `GET me` | Library with progress, and courses awaiting payment. |
| `GET courses/:slug` | Lessons. Links and files appear only for lessons the learner may open. |
| `POST courses/:slug/progress` | `{ lesson, done? }`. |

Lesson attachments: `GET /files/:id` also accepts the bearer token. The web app manifest is `/app-manifest` and its icons are `/app-icon/192|512`.
