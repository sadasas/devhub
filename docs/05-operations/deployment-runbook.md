# Deployment Runbook — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-10 |
| **Related documents** | [TDD §9](../02-architecture/technical-design.md#9-deployment-architecture) · [Monitoring](monitoring.md) · [Incident Response](incident-response.md) |

---

## 1. Hosting Decision (TBD)

| Option | Cost | Notes |
|---|---|---|
| Railway / Render | ~$5–7/mo | Managed Postgres add-on available; zero-ops deploys |
| VPS (Hetzner/DigitalOcean) | ~$5–6/mo | Full control; needs Caddy/Nginx, fail2ban, systemd |
| **Decision** | — | **Deferred to Phase 2.** All designs work on all three via env vars |

This runbook documents the generic path that works on all options; provider-specific steps are marked `[Railway]` / `[VPS]`.

---

## 2. Architecture at Deploy

```
Internet → HTTPS (proxy TLS) → container (node:22-alpine)
                                  ├── serves app/ static build
                                  ├── /api Express routes
                                  └── /mcp MCP server
                                        │
                                   Postgres (managed or container)
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
curl http://localhost:3000/api/health   # → {"status":"ok","db":"connected","uptime":...}
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

- `[Railway]` connect repo → set env vars → deploy; add managed Postgres, bind `DATABASE_URL`.
- `[Render]` same pattern; run migrations via a one-off command (`npm run db:migrate`) before first deploy.

---

## 6. Environment Variables

| Var | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `JWT_SECRET` | Yes | ≥ 32 chars random |
| `PORT` | No | Default 3000 |
| `NODE_ENV` | No | `production` for prod behaviors |
| `COOKIE_SECURE` | No | `true` behind TLS |
| `TRUST_PROXY` | No | `true` when behind a reverse proxy — required so rate limiting and client IPs work correctly (otherwise every request appears to come from the proxy IP) |

MCP keys live in Postgres (`mcp_keys` table), not env — each user manages their own via the app's **API Keys** page (`POST /api/keys`).

**SPA fallback:** the server only exposes the API (no static hosting). Host the built `app/dist` behind a static server (Caddy `file_server`, nginx, Cloudflare Pages, etc.) and route every non-file path — including `/project/*`, `/team/*`, `/docs/*`, and `/p/*` — to `index.html` so client-side routes (including public project pages) deep-link correctly.

**Never commit real values.** `server/.env` gitignored; `server/.env.example` holds placeholders.

---

## 7. First Deploy Checklist

- [ ] Migrations applied (`npm run db:migrate` on the deployed DB)
- [ ] `GET /api/health` → `ok`
- [ ] Register an account → login → create project → create an MCP key via the app's **API Keys** page (or `POST /api/keys`)
- [ ] Cookie header shows `HttpOnly; SameSite=Lax; Secure`
- [ ] `/mcp` rejects without key, works with a per-user key (curl, see [API Guide §7](../04-api/api-guide.md#7-mcp-examples))
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
