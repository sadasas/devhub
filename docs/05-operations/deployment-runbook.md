# Deployment Runbook — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Version** | 2.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-20 |
| **Related documents** | [TDD §9](../02-architecture/technical-design.md#9-deployment-architecture) · [Monitoring](monitoring.md) · [Incident Response](incident-response.md) |

---

## 1. Hosting Decision

| Option | Cost | Notes |
|---|---|---|
| **Render (free web service) + Neon (free Postgres)** | **$0** | **Decision (2026-08-20).** **Backend only** (API + MCP + WS). Free tier: 750 instance hrs/mo, 512 MB RAM, 0.1 CPU, 100 GB bandwidth, inbound WebSockets supported. Caveats: spins down after 15 min idle (30–60 s cold start), no persistent disk (stateless by design — state lives in Postgres). |
| Railway | ~$5–7/mo | $5 one-time credit only; no permanent free tier |
| VPS (Hetzner/DigitalOcean) | ~$5–6/mo | Full control; needs Caddy/Nginx, fail2ban, systemd — kept as fallback |
| **Decision** | — | **Render + Neon (free) for the backend.** The SPA (`app/dist`) is hosted separately on a static host (e.g. Cloudflare Pages / Vercel / Caddy `file_server`). All options still work via env vars |

Provider-specific steps are marked `[Render]` / `[Railway]` / `[VPS]`.

---

## 2. Architecture at Deploy

```
Internet → HTTPS (proxy TLS) → container (node:22-alpine)
                                  ├── /api Express routes
                                  ├── /ws WebSocket real-time
                                  └── /mcp MCP server
                                        │
                                   Postgres (managed or container)

SPA (app/dist) → static host (Cloudflare Pages / Vercel / Caddy) → calls /api with CORS_ORIGIN set
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

MCP keys are **not** deployment secrets — each user creates their own via `POST /api/keys` (stored hashed in Postgres). No `MCP_API_KEY` env var exists.

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

- `[Render]` — **backend deploy path (2026-08-20):**
  1. **Neon (database):** create a free project at [neon.tech](https://neon.tech) → copy the **direct** connection string (`postgresql://user:password@ep-….neon.tech/dbname`). Do **not** use the pooled (PgBouncer) string — DevHub uses advisory locks (migrations) and `FOR UPDATE` row locks, which break under transaction pooling.
  2. **Render:** push repo to GitHub → New → Blueprint → pick the repo (blueprint `render.yaml` at repo root auto-configures: free web service, build `npm ci && npm run build -w server`, start `npm run start -w server`, health check `/api/v1/health`, `autoDeploy: true`).
  3. Set env vars in the dashboard: `DATABASE_URL` (Neon direct string), `JWT_SECRET` (see §3), and `CORS_ORIGIN=https://<app>.vercel.app` (SPA origin — used for both REST CORS and the WebSocket origin allowlist in `ws-server.ts`).
  4. First deploy: migrations run automatically at boot (`index.ts` calls `migrate()`), then smoke-test §7.
  5. API base is reachable at `https://devhub-api.onrender.com` (blueprint service name; TLS auto-provisioned).
- `[Vercel]` — **frontend deploy path (2026-08-20):**
  1. `vercel.json` at repo root already sets `rootDirectory: app`, build `npm run build` (→ `dist`), and an SPA rewrite (every non-file path → `index.html`, so `/project/*`, `/p/*` deep-link correctly).
  2. Vercel dashboard: Import repo → framework Vite → set env `VITE_API_URL=https://devhub-api.onrender.com/api/v1` (build-time; the SPA uses it for `fetch` and derives the WebSocket URL `wss://devhub-api.onrender.com/ws` from it).
  3. Auto-deploy is on by default: every push to `main` rebuilds the SPA; PRs get preview URLs (previews hit the local backend via `npm run dev` unless you add their origin to `CORS_ORIGIN`).
- `[Railway]` connect repo → set env vars → deploy; add managed Postgres, bind `DATABASE_URL`.
- `[Render]` (with Render Postgres instead of Neon): same pattern, but the free Render Postgres **expires after ~30 days** — Neon is preferred for a free long-lived DB.

### 5.5 Auto-deploy & monorepo scoping

One push to `main` can trigger deploys on Vercel (frontend) and Render (backend). To avoid wasteful rebuilds when only one side changes, both platforms are configured with **path-based deploy filters** (Option A):

| Change in push | Deploys |
|---|---|
| `server/**`, `package.json`, `package-lock.json` | **Render only** |
| `app/**` (or a lockfile change affecting app deps) | **Vercel only** |
| both of the above | **both** |
| `docs/`, `.github/`, `e2e/`, `README.md`, etc. | **neither** |

- **Render:** `render.yaml` sets `buildFilter.paths: [server/**, package.json, package-lock.json]` (paths are repo-root-relative; the root directory stays the repo root because build/start use `-w server`). Render blueprint sync always processes `render.yaml` changes regardless of the filter. Service previews for PRs are skipped too when the PR only touches filtered-out files.
- **Vercel:** the built-in monorepo feature **"Skip unaffected projects"** is enabled by default for npm-workspaces repos (root `package.json` declares `workspaces`, all package names are unique, the app has no internal workspace deps). Verify it's still on under Project Settings → Root Directory → **Skip deployment**. It does not consume concurrent build slots (unlike an `ignoredBuildStep`).
- **Ordering when both change:** deploys are independent and parallel — keep API changes additive/backward-compatible; when a release couples FE+BE, deploy the backend first, verify `/api/v1/health`, then push the frontend.
- **CI:** enable branch protection on `main` requiring `.github/workflows/ci.yml` (unit + e2e) to pass before merge, so broken code never reaches the auto-deploys.
- **Verify the filters once:** push a docs-only commit (expect no deploys), then a `server/`-only commit (expect Render deploy only), then an `app/`-only commit (expect Vercel deploy only). Check each service's Events/Deployments timeline.

---

## 6. Environment Variables

| Var | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `JWT_SECRET` | Yes | ≥ 32 chars random |
| `PORT` | No | Default 3000 |
| `NODE_ENV` | No | `production` for prod behaviors |
| `COOKIE_SECURE` | No | `true` behind TLS (forced in production) |
| `TRUST_PROXY` | No | `true` when behind a reverse proxy — required so rate limiting and client IPs work correctly (otherwise every request appears to come from the proxy IP) |
| `CORS_ORIGIN` | FE split | Comma-separated origins allowed for cross-origin REST + WS (e.g. `https://<app>.vercel.app`). Empty = same-origin only |
| `VITE_API_URL` (Vercel build env) | FE split | `https://devhub-api.onrender.com/api/v1` — SPA fetch base + WebSocket origin (see `realtime-client.ts`) |

MCP keys live in Postgres (`mcp_keys` table), not env — each user manages their own via the app's **API Keys** page (`POST /api/keys`).

**Cookie / cross-site:** FE (Vercel) and BE (Render) are different origins, so the session cookie is sent with `SameSite=None; Secure` in production (`auth.routes.ts` sets `sameSite: none` when `NODE_ENV=production`). Development keeps `SameSite=Lax` (HTTP, same-origin).

**SPA fallback:** the server exposes the API only (no static hosting). Host the built `app/dist` behind a static server (Cloudflare Pages, Vercel, Caddy `file_server`, nginx, etc.) and route every non-file path — including `/project/*`, `/team/*`, `/docs/*`, and `/p/*` — to `index.html` so client-side routes (including public project pages) deep-link correctly (Vercel: handled by `vercel.json` rewrite). With the SPA on a different origin than the API, set `CORS_ORIGIN` to the SPA origin (dev proxy in `app/vite.config.ts` handles local development).

**Never commit real values.** `server/.env` gitignored; `server/.env.example` holds placeholders.

---

## 6b. Free-tier caveats (Render + Neon)

- **Sleep/cold start:** free web service spins down after 15 min without inbound traffic (HTTP or WS); next request takes 30–60 s. Acceptable for a personal hub. Optional keep-alive (external ping every ~10 min, e.g. UptimeRobot) keeps it warm — note it consumes instance hours, but a sleeping service consumes none, so total stays under 750 hrs/mo either way.
- **No persistent disk:** ephemeral filesystem — the backend stores nothing on disk (state is in Postgres), so this is a non-issue.
- **Neon caps:** 0.5 GB storage, compute suspends after ~5 min idle (cold DB start ~300–500 ms), no automatic backups — see [Backup & Recovery](backup-recovery.md) for periodic `pg_dump`.
- **WebSockets:** supported on free tier; a sleeping service is woken by a new WS connection like any request.
- **Cross-site cookie:** with FE on Vercel and BE on Render, the session cookie is `SameSite=None; Secure` (see §6). If you ever move to a same-origin deployment (VPS + Caddy serving the SPA and API on one domain), production still works — `SameSite=None; Secure` behaves correctly for same-site requests too.

---

## 7. First Deploy Checklist

- [ ] Migrations applied (auto at boot, or `npm run db:migrate` against the deployed DB)
- [ ] `GET /api/v1/health` → `ok`
- [ ] SPA (hosted separately) loads and calls `/api` cross-origin (check `CORS_ORIGIN`)
- [ ] Register an account → login → create project → create an MCP key via the app's **API Keys** page (or `POST /api/keys`)
- [ ] Cookie header shows `HttpOnly; SameSite=None; Secure` (production, cross-site) — `SameSite=Lax` in dev
- [ ] `/mcp` rejects without key, works with a per-user key (curl, see [MCP Guide §7](../03-engineering/mcp-integration.md#7-troubleshooting))
- [ ] Backup cron in place (next section)

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
| Bad release (app) | Redeploy previous image/tag; container restart |
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
| MCP key rotation | On exposure | Create new via `POST /api/keys`, update agent configs, revoke old via `DELETE /api/keys/:id` |
| `JWT_SECRET` rotation | On exposure or yearly | Session invalidation on rotation (all cookies invalid) |

---

*End of Deployment Runbook.*
