# Deployment Runbook — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Version** | 2.3 |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-24 |
| **Related documents** | [TDD §9](../02-architecture/technical-design.md#9-deployment-architecture) · [Monitoring](monitoring.md) · [Incident Response](incident-response.md) |

---

## 1. Hosting Decision

| Option | Cost | Notes |
|---|---|---|
| **Suga (free container) + Neon (free Postgres)** | **$0** | **Decision (2026-08-20).** **Backend only** (API + MCP + WS). Suga free: 1 project, always-on container, 0.1 vCPU / 256 MiB, 1 GB storage, no credit card, auto-build from GitHub on push, HTTPS/CDN/WAF via Cloudflare. Caveat: 256 MiB is tight → `PG_POOL_MAX=6` (see §6). |
| Railway | ~$5–7/mo | $5 one-time credit only; no permanent free tier |
| Render | $0 or $7/mo | Free web service exists but card verification was required in practice (2026-08-20) — kept as fallback |
| VPS (Hetzner/DigitalOcean) | ~$5–6/mo | Full control; needs Caddy/Nginx, fail2ban, systemd — kept as fallback |
| **Decision** | — | **Suga + Neon (free) for the backend.** The SPA (`app/dist`) is hosted separately on **Cloudflare Workers static assets** (2026-08-21, see ADR-042; previously Vercel). All options still work via env vars |

Provider-specific steps are marked `[Cloudflare]` / `[Suga]` / `[Railway]` / `[VPS]`.

---

## 2. Architecture at Deploy

```
Internet → HTTPS (proxy TLS) → container (node:22-alpine)
                                  ├── /api Express routes
                                  ├── /ws WebSocket real-time
                                  └── /mcp MCP server
                                        │
                                   Postgres (managed or container)

SPA (app/dist) → Cloudflare Worker devhub-app (static assets + /api proxy) ┐
SPA (admin/dist) → Cloudflare Worker devhub-admin (static assets + /api proxy) ┴→ Suga container (same Suga origin for both)
  Rule (ADR-051): SETIAP frontend deploy HARUS punya Worker proxy /api — tidak
  ada frontend yang memanggil Suga absolut. CORS_ORIGIN kosong (same-origin).
```

---

## 3. Prerequisites

- [ ] Node ≥ 22 locally, npm ≥ 10
- [ ] Docker + Docker Compose (local testing)
- [ ] Git repo pushed to origin
- [ ] Secrets ready: `DATABASE_URL`, `JWT_SECRET`

Generate secrets:

```bash
openssl rand -base64 48   # JWT_SECRET
```

MCP uses OAuth — no deployment secret for MCP. Tokens are obtained via `opencode mcp auth devhub` (PKCE) and stored client-side; revocation via Profile → Authorized Apps.

---

## 4. Build & Test Locally

```bash
# 1. Install
npm install

# 2. Local Postgres
docker compose up -d

# 3. Env
cp server/.env.example server/.env
# edit: DATABASE_URL=postgres://devhub:devhub@localhost:5432/devhub
#       JWT_SECRET=<random>

# 4. Migrate + test
npm run db:migrate
npm run test

# 5. Build & smoke test
npm run build
npm run start          # production server on :3000
curl http://localhost:3000/api/v1/health   # → {"status":"ok","db":"connected","uptime":...}
```

---

## 5. Deploy — Generic (Docker)

### 5.1 Build image

```bash
docker build -t devhub:$(git describe --tags || echo latest) .
```

### 5.2 Run (VPS with Docker)

```bash
docker run -d --name devhub \
  -p 3000:3000 \
  -e DATABASE_URL="postgres://..." \
  -e JWT_SECRET="..." \
  -e NODE_ENV=production \
  -e COOKIE_SECURE=true \
  --restart unless-stopped \
  devhub:latest
```

### 5.3 TLS (VPS)

Terminate TLS at Caddy (auto certs):

```
devhub.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

`Secure` cookies require `COOKIE_SECURE=true` behind TLS.

### 5.4 Managed platforms

- `[Suga]` — **backend deploy path (2026-08-20):**
  1. **Neon (database):** create a free project at [neon.tech](https://neon.tech) → copy the **direct** connection string (`postgresql://user:password@ep-….neon.tech/dbname`). Do **not** use the pooled (PgBouncer) string — DevHub uses advisory locks (migrations) and `FOR UPDATE` row locks, which break under transaction pooling.
  2. **Suga:** sign up at [suga.app](https://suga.app) (no credit card) → create a Project → add a **Container** → choose **Build from GitHub** → install the Suga GitHub App and grant `sadasas/devhub` → pick branch `main` → Dockerfile path `/Dockerfile` with build context at repo root (the repo `Dockerfile` builds only the `server/` workspace; `app/`/`e2e/` never enter the image).
  3. **Networking:** set the container port the app listens on (3000) and enable **Public HTTPS** on it — Suga provisions a TLS URL (Cloudflare CDN + WAF + DDoS included). Prod Suga host/container: **`cuddly-hawk`** — publik selalu via `https://devhub.nrawangbatin.my.id` (Worker proxy → Suga, same-origin).
  4. **Env vars** (mark secrets Sensitive): `DATABASE_URL` (Neon direct, bukan pooled/PgBouncer), `JWT_SECRET`, `NODE_ENV=production`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`, `CORS_ORIGIN=` (empty = same-origin only via Worker proxy), `PORT=3000`, `PG_POOL_MAX=6` (idle 30s, connection timeout 5s, `statement_timeout=30s` — lihat §6). Billing prod: `PAKASIR_SANDBOX=false`, `PAKASIR_SLUG`/`PAKASIR_API_KEY` prod (Sensitive), `APP_PUBLIC_URL=https://devhub.nrawangbatin.my.id`. Storage prod (Supabase, lihat §6): `DEVHUB_STORAGE_URL` + `DEVHUB_STORAGE_SERVICE_KEY` (Sensitive), `DEVHUB_STORAGE_BUCKET=devhub-attachments`, `DEVHUB_STORAGE_UPLOAD_MAX_MB=10`, `DEVHUB_STORAGE_TUS_ENDPOINT=` (kosong = auto-turun dari `DEVHUB_STORAGE_URL`).
  5. **Resources:** 0.1 vCPU / 256 MiB (free max). First deploy: migrations run automatically at boot (`index.ts` calls `migrate()`), then smoke-test §7.
  6. API base prod: `https://devhub.nrawangbatin.my.id/api` (Worker proxy → Suga `cuddly-hawk`); jangan sebar origin `*.suga.run` ke user/bundle. Auto-build on push to `main` is on by default (deduped by commit SHA).
- `[Cloudflare]` — **frontend deploy path (2026-08-21, Workers Builds + static assets, per ADR-042):**
  1. `app/wrangler.json` already defines the Worker (`devhub-app`) with static assets from `./dist` and `not_found_handling: "single-page-application"` — every non-file path (e.g. `/project/*`, `/p/*`) serves `index.html`, so client-side routes deep-link correctly. No worker script is needed; the SPA is pure static.
  2. Cloudflare dashboard: **Workers & Pages → Create → connect to GitHub** → install the Cloudflare GitHub App and grant `sadasas/devhub` → select the repo → set **Root directory** `/app`, **Install command** `npm ci`, **Deploy command** `npx wrangler deploy` (Workers Builds runs it after the build).
   3. **Build variables** (Settings → Variables and Secrets, set for both Production and Preview): `VITE_API_URL=/api/v1` (relative — same-origin via Worker proxy; runtime `app/src/lib/api.ts:27-46` memaksa relatif bila nilai absolut cross-site lolos). Legacy absolut ke Suga langsung (`https://cuddly-hawk.*` / `*.suga.run/api/v1`) JANGAN dipakai lagi. Also set `NODE_VERSION=22`.
   4. **Analytics (opsional, consent-gated):** `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` (ID asli HANYA di dashboard, JANGAN di repo). Tanpa ini bundle memakai placeholder `G-XXXXXXX` dan tidak ada request GA sama sekali. Berlaku bake-time seperti `VITE_API_URL` — ganti nilai = rebuild. Verifikasi live: cari ID di bundle (`Sources → Ctrl+Shift+F`); consent Accept → `gtag/js` + `collect` muncul (matikan adblocker saat verifikasi — uBlock/Brave/Firefox ETP memblokir `googletagmanager.com`).
  4. Auto-deploy is on by default: every push to the production branch rebuilds the SPA; non-production branches and PRs get preview URLs on `<commit>-devhub-app.workers.dev` (previews hit the local backend via `npm run dev` unless you add their origin to `CORS_ORIGIN`).
   5. Manual deploy alternative: `npm run build -w app && npm run deploy -w app` (wrangler login required once).
   6. `[Cloudflare]` — **admin frontend deploy path (2026-09-13, ADR-051):** same pattern as app, separate Worker:
       1. `admin/wrangler.json` defines Worker `devhub-admin` (`main: ./src/worker.ts` proxy → Suga, `run_worker_first: true`, `vars.SUGA_ORIGIN` = same Suga origin as app) + static assets `./dist` + `not_found_handling: "single-page-application"`.
       2. Cloudflare dashboard: **Workers & Pages → Create → connect to GitHub** → select the repo → set **Root directory** `/admin`, **Install command** `npm ci`, **Deploy command** `npx wrangler deploy`.
       3. **Build variables** (Production and Preview): `VITE_API_URL=/api/v1` (relative — same-origin via Worker proxy; runtime `admin/src/lib/api.ts` memaksa relatif bila nilai absolut cross-site lolos). Also set `NODE_VERSION=22`.
       4. **Custom domain** = admin subdomain (e.g. `admin.nrawangbatin.my.id`). Single login across app + admin requires `COOKIE_DOMAIN` on Suga (see §6) — the admin Worker preserves the parent-domain `Set-Cookie`.
- `[Railway]` connect repo → set env vars → deploy; add managed Postgres, bind `DATABASE_URL`.
- `[Render]` (fallback) same pattern as Suga with `render.yaml`; free Render Postgres **expires after ~30 days** — Neon is preferred for a free long-lived DB.

### 5.5 Auto-deploy & monorepo scoping

One push to `main` can trigger deploys on Cloudflare (frontend) and Suga (backend):

| Change in push | Deploys |
|---|---|
| `app/**` (or a lockfile change affecting app deps) | **Cloudflare only** (Workers Builds watch paths can be scoped to `/app/**` under Settings → Build → Build watch paths; without them every push rebuilds) |
| any push touching `server/**` or root `package.json`/`package-lock.json` | **Suga** (auto-build on push to the watched branch; deduped by commit SHA) |
| `docs/`, `.github/`, `e2e/`, `README.md`, etc. | **neither** (Cloudflare skips via watch paths; Suga may still rebuild — see below) |

- **Cloudflare:** Workers Builds supports **build watch paths** — set them to `app/**` plus the root lockfile (`package-lock.json`) so app deploys only run when frontend code or deps change. Builds run in Cloudflare's CI (no GitHub Actions minutes consumed).
- **Suga:** auto-build on push to the watched branch is on by default and has **no path filters**. The backend build is fast (`npm ci` + `tsc`, ~1–2 min) and deduped by commit SHA, so a docs-only push that also triggers a Suga rebuild is acceptable. If you want to avoid even that, watch a dedicated **release branch** instead of `main` (Suga supports per-environment branches — merge to it only when you intend to deploy the backend).
- **Ordering when both change:** deploys are independent and parallel — keep API changes additive/backward-compatible; when a release couples FE+BE, deploy the backend first, verify `/api/v1/health`, then push the frontend.
- **CI:** enable branch protection on `main` requiring `.github/workflows/ci.yml` (unit + e2e) to pass before merge, so broken code never reaches the auto-deploys. Note: Cloudflare Workers Builds deploys independently of CI status — if you want deploy-after-green-CI, gate merges with branch protection instead.
- **Verify once:** push a docs-only commit (expect Cloudflare to skip; Suga may show a rebuild), then a `server/`-only commit (Suga deploys only), then an `app/`-only commit (Cloudflare deploys only). Check each service's deploy timeline.

---

## 6. Environment Variables

| Var | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `JWT_SECRET` | Yes | ≥ 32 chars random |
| `PORT` | No | Default 3000 (set explicitly on Suga) |
| `PG_POOL_MAX` | No | Max pg pool connections (default 20; set **6** on memory-constrained hosts like Suga free `cuddly-hawk`). Pool efektif: `max=PG_POOL_MAX`, `idleTimeoutMillis=30000`, `connectionTimeoutMillis=5000`, `statement_timeout=30000` (`server/src/db/pool.ts`). Pakai Neon **direct** string, bukan pooled (advisory lock + `FOR UPDATE` pecah di transaction pooling) |
| `DEVHUB_STORAGE_URL` | Storage | Supabase project URL (`https://<ref>.supabase.co`), kosong = upload mati (`503 STORAGE_DISABLED`) |
| `DEVHUB_STORAGE_SERVICE_KEY` | Storage | Supabase service_role key — **Sensitive di Suga**, tidak pernah ke browser/bundle |
| `DEVHUB_STORAGE_BUCKET` | Storage | Nama bucket objek, default `devhub-attachments` |
| `DEVHUB_STORAGE_UPLOAD_MAX_MB` | Storage | Batas upload per file (MB, default 10) |
| `DEVHUB_STORAGE_TUS_ENDPOINT` | Storage | Override endpoint TUS resumable; kosong = auto-turun (`https://<ref>.storage.supabase.co/storage/v1/upload/resumable`). Upload utama TUS presigned (`x-signature`), fallback PUT satu-request via signed URL |
| `NODE_ENV` | No | `production` for prod behaviors |
| `COOKIE_SECURE` | No | `true` behind TLS (forced in production) |
| `TRUST_PROXY` | No | `true` when behind a reverse proxy — required so rate limiting, client IPs, and OAuth discovery origin (`/.well-known/*` → `https://devhub.nrawangbatin.my.id`) work correctly |
| `CORS_ORIGIN` | FE split | Comma-separated origins allowed for cross-origin REST + WS. **Prod (same-origin via Worker proxy): leave empty** so the API is same-origin only. Only set when the SPA is truly cross-origin (legacy split) |
| `COOKIE_DOMAIN` | FE split | Parent domain for the session cookie — **single login across app + admin subdomains (ADR-051)**. Prod (Suga): `.nrawangbatin.my.id`. Empty = host-only cookie (local dev, single frontend) |
| `VITE_API_URL` (Cloudflare build variable) | FE split | **`/api/v1` (relative, same-origin via Worker proxy)** — SPA fetch base + WebSocket origin (see `realtime-client.ts`). Legacy absolute form ke Suga langsung (prod host `cuddly-hawk`) is force-rewritten to `/api/v1` at runtime (`app/src/lib/api.ts:27-46`), but do NOT deploy new builds with the absolute value |
| `VITE_GA_MEASUREMENT_ID` (Cloudflare build variable) | FE analytics | GA4 measurement ID (`G-XXXXXXXXXX`, real value dashboard-only). Empty/missing = placeholder `G-XXXXXXX` = zero GA network. Consent-gated page_view only (`app/src/lib/consent.ts`); bake-time — changing it requires rebuild |
| `RESEND_API_KEY` | Mail (M31) | Resend API key, permission **Sending access** only. Empty = worker holds queue, nothing sends. **Sensitive on Suga** |
| `MAIL_FROM` | Mail (M31) | Sender identity, e.g. `DevHub <noreply@devhub.nrawangbatin.my.id>` — domain must be Verified in Resend (DKIM + SPF) |
| `MAIL_ENABLED` | Mail (M31) | `true` to actually send; `false` (default) = enqueue only, queue flushed when enabled. Kill-switch for mail incidents |

**Cookie / same-origin ( kunci: JANGAN ganti kode ke `SameSite=None` ):** each SPA and the API are served from **one origin per frontend** (`https://devhub.nrawangbatin.my.id` for app, the admin subdomain for admin) — each Cloudflare Worker (`app/src/worker.ts`, `admin/src/worker.ts`) proxies `/api/*`, `/mcp`, `/oauth/*`, `/ws`, `/.well-known/*`, and `/webhooks/*` (GitHub App deliveries must reach the backend — without this they hit the SPA as 405) to Suga while serving static assets for everything else, and strips `Domain` from `Set-Cookie` **only when it points at the backend host**, preserving the parent-domain session cookie (`COOKIE_DOMAIN`, ADR-051) so one login covers both frontends while staying **first-party**. Therefore the session cookie is **`SameSite=Lax; HttpOnly; Secure`** in production (`server/src/shared/cookie.ts`), which blocks CSRF yet is sent on same-origin top-level and sub-requests. `SameSite=None` is intentionally NOT used — switching the code to `None` would turn a first-party session into a third-party cookie (blocked by Safari/Firefox ITP, CSRF surface). If login loops with 401, fix the proxy/origin — never the cookie.

**SPA fallback:** the server exposes the API only (no static hosting). Host the built `app/dist` behind a static server (Cloudflare Workers static assets, Caddy `file_server`, nginx, etc.) and route every non-file path — including `/project/*`, `/team/*`, `/docs/*`, and `/p/*` — to `index.html` so client-side routes (including public project pages) deep-link correctly (Cloudflare: handled by `not_found_handling: "single-page-application"` in `app/wrangler.json`). With the SPA on a different origin than the API, set `CORS_ORIGIN` to the SPA origin (dev proxy in `app/vite.config.ts` handles local development).

**Never commit real values.** `server/.env` gitignored; `server/.env.example` holds placeholders.

---

## 6b. Free-tier caveats (Suga + Neon)

- **Tight memory:** Suga free caps at **256 MiB** — a service that exceeds it is OOM-killed and restarted (state is safe: everything lives in Postgres). Keep `PG_POOL_MAX=6` and watch the memory metric/logs; if OOMs appear, reduce the pool further or raise memory when you move off free.
- **Always-on:** Suga free containers do not spin down (unlike Render) — no cold starts, WebSocket connections stay up.
- **1 project / 1 environment:** free tier supports a single project with one environment (production). No preview environments on free.
- **Builds from GitHub only:** free services can build from your GitHub repo or approved templates — not arbitrary registry images (fine for DevHub; `Dockerfile` at repo root).
- **Neon caps:** 0.5 GB storage, compute suspends after ~5 min idle (cold DB start ~300–500 ms), no automatic backups — see [Backup & Recovery](backup-recovery.md) for periodic `pg_dump`.
- **Same-origin session (bukan cross-site):** FE + API satu origin `https://devhub.nrawangbatin.my.id` via Worker proxy → cookie `SameSite=Lax; Secure` (lihat §6). Produksi tetap berfungsi untuk request same-site; pola lama `SameSite=None; Secure` untuk split FE/BE **sudah pensiun** — jangan dihidupkan lagi. Bila suatu saat kembali ke deploy same-host tunggal (VPS + Caddy serving SPA + API satu domain), tidak ada perubahan kode cookie yang diperlukan.

---

## 7. First Deploy Checklist

- [ ] Migrations applied (auto at boot, or `npm run db:migrate` against the deployed DB)
- [ ] `GET /api/v1/health` → `ok`
- [ ] SPA loads same-origin and calls `/api` without CORS (check `CORS_ORIGIN` empty in prod)
- [ ] Register an account → verify via email link → login → create project → `opencode mcp auth devhub` (browser OAuth PKCE)
- [ ] Cookie header shows `HttpOnly; SameSite=Lax; Secure` (production, same-origin via proxy) — `SameSite=Lax` in dev (HTTP, `Secure` off)
- [ ] `/mcp` rejects without token, works with OAuth bearer (curl with `jq -r .access_token ~/.local/share/opencode/mcp-auth.json`, see [MCP Guide §7](../03-engineering/mcp-integration.md#7-testing-the-mcp-server))
- [ ] Backup cron in place (next section)
- [ ] Guard `VITE_API_URL` same-origin lolos: `node app/scripts/guard-vite-api-url.mjs` hijau (gagal bila logika force-relatif di `app/src/lib/api.ts:27-46` / `realtime-client.ts` hilang) + `npm run test -w app` lolos
- [ ] Guard admin lolos: `node admin/scripts/guard-vite-api-url.mjs` hijau (gagal bila logika force-relatif di `admin/src/lib/api.ts` hilang) + `npm run test -w admin` lolos
- [ ] Cookie `Domain=.nrawangbatin.my.id` terlihat di devtools (login via app maupun admin); `grep -r suga.run admin/dist` nol hit (origin BE tidak bocor ke bundle)
- [ ] Single session (ADR-051): login di app → buka admin → `/auth/me` 200 tanpa login ulang; logout di satu frontend → frontend lain `/auth/me` 401
- [ ] Storage smoke (Supabase TUS): `POST /api/v1/attachments/presign` → dapat `tusEndpoint` + `uploadToken`; upload 1 file kecil via TUS OK; fallback PUT via `uploadUrl` OK bila TUS gagal; file tanpa konfigurasi storage → `503 STORAGE_DISABLED` (bukan 500)
- [ ] i18n smoke (P0+P1): ganti bahasa ID↔EN di app + admin → tidak ada string kosong/fallback mentah di header, template/label picker, billing, dan auth; `?lang=` deep-link konsisten
- [ ] Mobile smoke: viewport 390px — template/label picker bisa dibuka, menu kebab (⋮) per kartu terlihat & terpakai touch, drawer navigasi + top bar OK, upload lampiran tidak memicu iOS zoom

### 7b. Suga production checklist (billing live)

Hanya via dashboard Suga — JANGAN commit nilai asli ke repo (hanya docs + `server/.env.example` komentar):

- [ ] `PAKASIR_SANDBOX=false`
- [ ] `PAKASIR_SLUG` + `PAKASIR_API_KEY` prod terisi, keduanya ditandai **Sensitive**
- [ ] `APP_PUBLIC_URL=https://devhub.nrawangbatin.my.id`
- [ ] `COOKIE_SECURE=true` (guard `server/src/config.ts:74-78` menolak boot produksi tanpanya)
- [ ] `TRUST_PROXY=true`
- [ ] `PG_POOL_MAX=6`
- [ ] `CORS_ORIGIN` kosong (same-origin; isi hanya bila darurat split-origin sementara)
- [ ] `COOKIE_DOMAIN=.nrawangbatin.my.id` (single session app + admin, ADR-051)
- [ ] `VITE_API_URL=/api/v1` (build variable Cloudflare; JANGAN absolut ke Suga/`cuddly-hawk` langsung)
- [ ] Webhook Pakasir menunjuk `https://devhub.nrawangbatin.my.id/api/v1/billing/webhook` (proxied Worker → Suga; test dengan payload kecil, ekspektasi `200 {ok:true}` tanpa aktivasi untuk order tak dikenal)
- [ ] Pricing seed ADR-045 diterapkan: `psql "$DATABASE_URL" -f server/src/db/seeds/001_pro_pricing_2026-09-13.sql`, lalu verifikasi paket Pro `is_featured` + harga `(30,249000) (90,699000) (365,2490000)` + promo LAUNCH149 `(30,149000)` nonaktif
- [ ] Email (M31): `MAIL_ENABLED=true`, `MAIL_FROM=DevHub <noreply@devhub.nrawangbatin.my.id>`, `RESEND_API_KEY` prod terisi + **Sensitive**; domain Verified di dashboard Resend (DKIM + 2 CNAME SPF hijau)
- [ ] Email smoke test prod: register akun uji → cek inbox (SPF/DKIM/DMARC PASS, tidak spam) → klik verify → login OK; `POST /api/v1/mail/outbox/process` (auth) → `{processed:0,...,pending:0}`

---

## 8. Release Procedure (per version)

1. Tag `vX.Y.Z` on `main` (see [Git Workflow §4](../03-engineering/git-workflow.md#4-tagging--releases)).
2. `npm audit` clean.
3. Take backup (see [Backup & Recovery](backup-recovery.md)) — *before* deploy.
4. Build image, deploy, smoke test health + login.
5. Update milestone changelog in-app; update docs if behaviors changed.
6. Monitor logs for 15 minutes post-deploy.

---

## 9. Rollback

| Situation | Action |
|---|---|
| Bad release (backend) | Redeploy previous image/tag; container restart |
| Bad release (SPA, `[Cloudflare]`) | Workers & Pages → devhub-app → **Deployments → deployment history → Rollback** to the previous version (instant, no rebuild) |
| Bad migration (DB) | Restore from pre-release backup (see [Backup & Recovery](backup-recovery.md) §4) |
| Config error | Fix env, restart container — no DB impact |

---

## 10. Routine Maintenance

| Task | Frequency | Notes |
|---|---|---|
| Security patches (`npm audit`) | Monthly / on advisory | Apply, test, release patch |
| Postgres minor upgrade | Per provider window | Test locally first |
| Backup restore drill | Quarterly | See [Backup & Recovery](backup-recovery.md) §5 |
| Log rotation | Automated | See [Monitoring](monitoring.md) |
| MCP token rotation | On exposure | `DELETE /oauth/authorized-apps/:clientId` or `POST /oauth/revoke`, then `opencode mcp auth devhub` |
| `JWT_SECRET` rotation | On exposure or yearly | Session invalidation on rotation (all cookies invalid) |

---

*End of Deployment Runbook.*
