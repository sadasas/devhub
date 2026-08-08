# Deployment Runbook — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-09 |
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
- [ ] Secrets ready: `DATABASE_URL`, `JWT_SECRET`, `MCP_API_KEY`

Generate secrets:

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -hex 32      # MCP_API_KEY
```

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
#       JWT_SECRET=<random>  MCP_API_KEY=<random>

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
  -e MCP_API_KEY="..." \
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
| `MCP_API_KEY` | Yes | Bearer key for AI agents |
| `PORT` | No | Default 3000 |
| `NODE_ENV` | No | `production` for prod behaviors |
| `COOKIE_SECURE` | No | `true` behind TLS |

**Never commit real values.** `server/.env` gitignored; `server/.env.example` holds placeholders.

---

## 7. First Deploy Checklist

- [ ] Migrations applied (`npm run db:migrate` on the deployed DB)
- [ ] `GET /api/health` → `ok`
- [ ] Register an account → login → create project
- [ ] Cookie header shows `HttpOnly; SameSite=Lax; Secure`
- [ ] `/mcp` rejects without key, works with key (curl, see [API Guide §6](../04-api/api-guide.md#6-mcp-examples))
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
| `JWT_SECRET` / `MCP_API_KEY` rotation | On exposure or yearly | Update agent configs after key rotation |

---

*End of Deployment Runbook.*
