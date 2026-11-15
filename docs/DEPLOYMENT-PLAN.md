# Kalaa production deployment plan

Status: **plan, nothing created yet** (written 2026-11-13).
Model: the same setup that took survflow/Datsnip live (`~/Downloads/datsnip-infra`): one Hetzner server, Cloudflare in front,
OpenTofu for cloud resources, Ansible for everything on the server, nightly backups to R2, Resend for email.

---

## 1. What survflow does, and what changes for kalaa

| Piece | Survflow (live today) | Kalaa |
|---|---|---|
| Infra repo | `datsnip-infra` (private): Ansible roles + OpenTofu (`terraform/hetzner`, `terraform/cloudflare`), `make` targets, docs (AGENTS, ARCHITECTURE, SETUP-LOG, RUNBOOK, TROUBLESHOOTING, SECRETS) | New private repo **`kalaa-infra`**, copied from `datsnip-infra`'s skeleton. Keep the reusable roles (`common`, `hardening`, `costguard`, `credentials`, `nodejs`, `caddy`, `backup`); replace `postgresql`, `clickhouse`, `golang`, `app` with `mongodb` and `kalaa` |
| Server | Hetzner CAX21 (ARM, 8 GB), Falkenstein | Its own server (see decision D1). Kalaa needs about 2–3 GB of RAM: Node, MongoDB with a 1 GB cache, and the build |
| Static front ends | 4 Cloudflare Pages projects | **None.** Kalaa is one Next.js app that serves the landing page, studio, editor, storefronts, the mobile API and cron. Everything goes to the server through Cloudflare |
| Database | PostgreSQL + ClickHouse on the server, loopback only | **MongoDB 8** on the server as a **single-node replica set** (transactions need one), loopback only, auth with a keyFile |
| Files | none | Lesson attachments and media library on the **server's disk** (`STORAGE_DRIVER=local`, needs one small code change), backed up to R2 |
| Hostnames | `api.`, `app.`, `docs.`, `test.`, apex | apex + `www` (platform), **wildcard `*.kalaa.so`** (storefronts), `edge.kalaa.so` (target for creators' custom domains) |
| Custom domains | none | **Cloudflare for SaaS** custom hostnames. The code already supports it through `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ZONE_ID`. First 100 hostnames are free |
| TLS | Cloudflare Full (strict) + Origin CA cert in Caddy | Same. Origin CA cert for `kalaa.so` + `*.kalaa.so` |
| Deploy | Pages: on push. Backend: `make deploy` | `make deploy` (Ansible): build a new release next to the live one, migrate, switch over, health check |
| Cron | n/a | Vercel Cron → **systemd timer** calling `/api/cron/publish` every 5 min with `CRON_SECRET` |
| Email | Resend, domain `datsnip.com` | Resend, domain `kalaa.so` (see D4: free plan limits) |
| Backups | nightly pg_dump + ClickHouse export → R2 `survflow-backups` | nightly `mongodump --archive --gzip` + files directory → R2 **`kalaa-backups`**, and **a restore test before launch** (survflow still hasn't done one) |
| Guard rails | `costguard`, fail2ban, sshd hardening, Hetzner firewall only lets Cloudflare reach 80/443 | Same roles, same firewall |

---

## 2. Decisions (recommended default in bold; change any before Phase 1)

| # | Decision | Options | Why the default |
|---|---|---|---|
| D1 | Where the server runs | **New Hetzner server in Singapore (CPX21, x86, ~4 GB)**, or a new CAX11/CAX21 in Germany (cheaper, ARM), or share `datsnip-prod` | Learners and teachers are in India (the README picked Vercel Mumbai). Germany adds about 130–150 ms to every server-rendered page from India; Singapore about 60–70 ms. Sharing the survflow box is free, but MongoDB + Node next to ClickHouse at 40% RAM is tight, and one outage would take down both products. Check Hetzner's current Singapore price and included traffic before ordering |
| D2 | Domain | **`kalaa.so`** (the code, `.env.example` and README assume it) | Must be bought and moved onto Cloudflare DNS. Wildcard subdomains and Cloudflare for SaaS both need the zone on Cloudflare |
| D3 | Database | **MongoDB on the server** or MongoDB Atlas | Free, same pattern as survflow, no network hop. Atlas with backups starts at M10 (~$57/mo). Revisit when there are paying learners |
| D4 | Email | **Separate Resend account (free)** or Resend Pro ($20/mo) | Resend's free plan allows **1 domain** (already `datsnip.com`) and **100 emails/day**. Kalaa sends sign-in codes, invites, lead alerts and announcements (up to 500 recipients each). A separate free account works for launch. Move to Pro before announcements are used for real |
| D5 | Infra repo | **New private `kalaa-infra`** | The kalaa app repo is **public**, so server IPs, IDs and tfstate can't live in it. Keeping it separate from `datsnip-infra` means the two products can't break each other |
| D6 | File storage | **Server disk** now, an R2 `BlobStore` driver later | Works today with the existing `local` driver (uploads pass through our server; no 4.5 MB Vercel limit). Disk use is capped per site (300 MB media + 500 MB files). Write an R2 driver when disk use passes about 50% |

---

## 3. Code changes needed in this repo (small, one PR)

1. **Configurable storage directory.** `src/server/storage/local.ts` writes to `<cwd>/.data/files`. With release directories, cwd changes every deploy and the files would be lost. Add `STORAGE_DIR` (default `.data/files`), set it to `/var/lib/kalaa/files` in production.
2. **Real client IP.** `src/app/sites/[site]/lead-actions.ts` and `src/server/app-api.ts` use the first entry of `X-Forwarded-For`. Behind Caddy, that would be a Cloudflare edge IP, so every visitor would share one rate-limit bucket. Survflow hit exactly this bug (`TROUBLESHOOTING.md` 18d). Fixed in a shared `clientIp()` helper (`src/server/client-ip.ts`) that reads the header named by `CLIENT_IP_HEADER` (production: `cf-connecting-ip`) and otherwise the first `X-Forwarded-For` entry. It is opt-in because on Vercel a client could send its own `CF-Connecting-IP`. Caddy also passes `X-Forwarded-For` from `CF-Connecting-IP`. The firewall only lets Cloudflare connect, so the header can be trusted.
3. **Self-hosted docs.** Add a "Deploying to your own server" section to `README.md` and `.env.example`, and fix `docs/ARCHITECTURE.md` (it says Vercel Blob and the Vercel edge are the only path). Keep the Vercel path working: it is the fallback.
4. **Pre-merge gate in CI.** GitHub Action running `npm ci && npm run typecheck && npm run check:sections && npm run build` on PRs. Same lesson as survflow: run the real build, not just `tsc`.
5. Leave alone: `@vercel/functions` (`attachDatabasePool` only runs when `VERCEL` is set), the `.vercel.app` check in `isPlatformHost`, and the Vercel/Blob drivers. None of them do anything when self-hosted.

Already fine: health check at `/api/health`, migrations with a lock (`npm run db:migrate`), seeding refuses production database names, cookies are `secure` in production, sign-in cookies are host-only per storefront.

---

## 4. Infrastructure (`kalaa-infra`)

### OpenTofu: `terraform/hetzner`
- SSH key `~/.ssh/id_ed25519_kalaa`, server `kalaa-prod` (Ubuntu 24.04) with delete and rebuild protection, cloud-init `ubuntu` user, root SSH off.
- Cloud Firewall: 22 open, 80/443 **from Cloudflare IP ranges only**.

### OpenTofu: `terraform/cloudflare`
- Zone settings: SSL **Full (strict)**, Always HTTPS, HSTS, browser cache TTL "respect origin". **Bot Fight Mode off** (it blocked survflow sign-up with a 403, TROUBLESHOOTING #17).
- DNS (all proxied): `kalaa.so` A, `www` CNAME, `*` A (wildcard storefronts), `edge` A (custom-domain target).
- Cloudflare for SaaS: fallback origin = `edge.kalaa.so`.
- R2 bucket `kalaa-backups` with a lifecycle rule (delete after 30 days; survflow has no retention rule yet).
- Resend DNS records (SPF, DKIM, return path) + a DMARC record.

### Ansible roles, in order
| Role | Source | Notes |
|---|---|---|
| `common` | copy | swap 2–4 GB (the Next build needs it) |
| `costguard` | copy | same limits to start; alerts to your email |
| `hardening` | copy | fail2ban + sshd drop-in |
| `credentials` | adapt | generates the MongoDB app password, admin password and replica-set keyFile **on the server** (`/etc/kalaa/db-credentials.env`, root 0600) |
| `mongodb` | **new** | MongoDB 8 apt repo, `bindIp: 127.0.0.1`, `replication.replSetName: rs0`, `security.authorization` + keyFile, `wiredTiger cacheSizeGB: 1`, `rs.initiate` once, admin user + `kalaa` user (readWrite on `kalaa`) |
| `nodejs` | copy | Node 22 |
| `kalaa` | **new** (replaces `app`) | see deploy flow below; systemd unit `kalaa` (`next start -p 3000 -H 127.0.0.1`), env file `/etc/kalaa/kalaa.env` 0600, `kalaa-publish.timer` every 5 min |
| `caddy` | adapt | one site block for every host on :443 with the Origin CA cert, `reverse_proxy 127.0.0.1:3000`, `header_up X-Forwarded-For {http.request.header.CF-Connecting-IP}`, access log |
| `backup` | adapt | 03:00 UTC: `mongodump --archive --gzip` + tar of `/var/lib/kalaa/files` → `rclone` → R2; log `/var/log/kalaa-backup.log` |

### Deploy flow (`make deploy`): no downtime during the build
1. `git clone --depth 1` the **public** repo over https (no deploy key needed) into `/srv/kalaa/releases/<sha>`.
2. `npm ci`, then `npm run db:migrate` with the production env. Migrations only add fields, so the old release keeps working.
3. `next build` with `NEXT_PUBLIC_ROOT_DOMAIN=kalaa.so` in the **build** environment (it is inlined at build time) and `NODE_OPTIONS=--max-old-space-size=2048`.
4. Point the `/srv/kalaa/current` symlink at the new release, `systemctl restart kalaa` (a few seconds of restart), wait for `/api/health` to answer `ok`.
5. Keep the last 3 releases. **Rollback** = `make rollback` (symlink back + restart).

### Production environment (`/etc/kalaa/kalaa.env`)
| Var | Value |
|---|---|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `kalaa.so` (also at build time) |
| `MONGODB_URI` | `mongodb://kalaa:<generated>@127.0.0.1:27017/?replicaSet=rs0&authSource=kalaa` |
| `MONGODB_DB` | `kalaa` |
| `STORAGE_DRIVER` / `STORAGE_DIR` | `local` / `/var/lib/kalaa/files` |
| `RESEND_API_KEY`, `MAIL_FROM` | vault / `Kalaa <signin@kalaa.so>` |
| `CNAME_TARGET` | `edge.kalaa.so` |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` | vault (a token scoped to **SSL and Certificates: Edit** on the zone only, not the OpenTofu token) |
| `CRON_SECRET` | generated on the server |
| `ANTHROPIC_API_KEY` | vault, optional (shows "Write my page with AI") |

Secrets follow survflow's rules: `make set-secret NAME=…` writes them from a hidden prompt into git-ignored files. **Never paste a key into chat.** Survflow's first deploy did, and every one of those keys is still marked "rotate" in `datsnip-infra/docs/SECRETS.md`.

---

## 5. Rollout phases

| Phase | Who | Steps | Done when |
|---|---|---|---|
| **0. Accounts** (manual, can't be automated) | You | Buy `kalaa.so`, add it to Cloudflare and switch nameservers. Create a Hetzner project + API token. In Cloudflare: R2 token for `kalaa-backups`, OpenTofu API token (DNS, Zone Settings, SSL & Certificates, R2), Origin CA cert. Resend account + API key. Load each with `make set-secret` | `dig NS kalaa.so` shows Cloudflare |
| **1. App PR** | Claude | Code changes in §3, PR to `main`, CI green | merged |
| **2. Infra repo** | Claude | Create private `kalaa-infra` from the datsnip skeleton, new roles, docs, gates (`ansible-lint`, `tofu validate`) | `make check` passes |
| **3. Server** | Claude, with your OK on the paid resource | `make hz-plan` → you approve → `make hz-apply` → `make provision` | `ssh` works, `mongosh` shows `rs0` PRIMARY, `systemctl status kalaa` active |
| **4. Edge** | Claude | `make tf-plan` → you approve → `make tf-apply` | `curl https://kalaa.so/api/health` → `{"ok":true}` |
| **5. Backups** | Claude | `make backup`, then **restore into a scratch database and check record counts** | restore verified, written down in RUNBOOK |
| **6. Smoke test** | Claude + you | Sign up as the owner, create a site, open `<slug>.kalaa.so`, learner sign-in by emailed code, upload a lesson file and an image, publish, schedule a publish (wait for the timer), lead form, AI draft. Add one custom domain you own and watch it reach "active" | every item passes |
| **7. Launch** | You | Add an uptime monitor on `/api/health` (UptimeRobot free) and a Hetzner billing alert | live |

---

## 6. Risks and how they're handled

| Risk | Handling |
|---|---|
| Creator domains with Full (strict): the Origin CA cert covers `*.kalaa.so` but not `learn.creator.in` | Test in Phase 6. If Cloudflare refuses the origin cert for custom hostnames, add a Configuration Rule that uses SSL "Full" for requests that don't match `*.kalaa.so` (the traffic still only reaches the server from Cloudflare) |
| Creators can't CNAME an apex domain (`creator.in`) at most DNS providers | Tell them to use a subdomain (`learn.creator.in`) or a provider with CNAME flattening. This is how the code works today |
| Single server holds the database and files | Nightly R2 backups + a tested restore. Hetzner snapshots (~20% of the server price) as an extra layer |
| Disk fills with uploads | `costguard` disk trip at 92%, warning at 80%. R2 storage driver as the next step |
| Resend daily cap | D4. Move to Pro before the first big announcement |
| `NEXT_PUBLIC_ROOT_DOMAIN` missing at build time makes storefront routing break silently | It is set in the build step's environment, and the post-deploy check opens a storefront host as well as `/api/health` |
| Wildcard SSL | Cloudflare Universal SSL covers `kalaa.so` and `*.kalaa.so` (one level). Storefronts are one level, so no paid cert is needed |

---

## 7. Monthly cost (approximate; check current prices before ordering)

| Item | Cost |
|---|---|
| Hetzner server (D1: Singapore CPX21, or Germany CAX11/CAX21) | about €5–15 |
| Domain `kalaa.so` | `.so` domains are pricier than `.com`; check at the registrar |
| Cloudflare (DNS, proxy, SSL, SaaS ≤100 hostnames, R2 <10 GB) | free |
| Resend | free (separate account), or $20/mo for Pro |
| Anthropic API (optional AI drafts, capped at 6 per site per hour) | pay per use |
