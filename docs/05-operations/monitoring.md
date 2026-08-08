# Monitoring & Observability — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-09 |
| **Related documents** | [Deployment Runbook](deployment-runbook.md) · [Incident Response](incident-response.md) · [Security Design](../02-architecture/security-design.md) |

---

## 1. Principles

- **Minimal, meaningful, cheap.** Solo ops: one health endpoint, structured logs, one alert channel (ntfy/email). No metrics platform until Phase 3.
- Health = app process + database reachability.
- Logs = errors + auth events + slow requests; never secrets.

---

## 2. Health Checks

### 2.1 Endpoint

`GET /api/health` → 200:

```json
{ "status": "ok", "db": "connected", "uptime": 12345.6 }
```

- `db` checks `SELECT 1` on the pool.
- `503` when DB unreachable → triggers the uptime monitor.

### 2.2 Uptime monitoring

| Option | Notes |
|---|---|
| UptimeRobot (free tier) | HTTP check every 5 min on `/api/health` |
| Better Stack / Healthchecks.io | Optional; keep one provider |
| **Choice (Phase 2)** | UptimeRobot free tier |

Alert target: ntfy.sh topic (push to phone) and/or email.

---

## 3. Logging

| Level | Events | Where |
|---|---|---|
| `INFO` | server start, user register/login/logout, project create/delete | stdout → provider logs |
| `WARN` | validation failures, rate-limit hits, import version mismatch, MCP auth failures | stdout |
| `ERROR` | unhandled errors, DB errors, backup failures | stdout + error channel |

Rules:

- JSON lines (`{"level":"error","time":"...","msg":"..."}`) — grep-able.
- **Never** log: passwords, JWT contents, cookie values, MCP API keys, full state payloads.
- Request logging: method, path, status, duration-ms, user id (no body).
- `[VPS]` ship logs to a rotation tool (logrotate) or a cheap aggregator (e.g., Loki) at Phase 3.

---

## 4. Alerting

| Alert | Trigger | Action |
|---|---|---|
| Site down | health check fails ×3 | UptimeRobot → ntfy push |
| Backup failed | cron exit code ≠ 0 | ntfy push (see [Backup & Recovery](backup-recovery.md) §6) |
| Auth abuse | rate-limit hits spike | Manual log review; consider IP block |
| High error rate | `ERROR` count > threshold/5min | Investigate logs |

Single channel: **ntfy.sh** topic `devhub-alerts` (free, privacy-friendly, aligns with local-first philosophy).

---

## 5. Key Metrics (manual review cadence)

| Metric | Where | Cadence |
|---|---|---|
| Health uptime | UptimeRobot dashboard | Weekly glance |
| Error count + top 5 errors | Provider log search | Weekly |
| DB size, growth | `SELECT pg_size_pretty(...)` | Monthly |
| Active users (self) | `/api/auth/me` + log lines | Monthly |
| Backup success/failure | Cron log + drill table | Monthly |

---

## 6. Instrumentation Plan by Phase

| Phase | Adds |
|---|---|
| V1 (now) | Health endpoint, structured JSON logs, backup alert hook |
| Phase 2 | UptimeRobot, ntfy alerting, request-duration logging |
| Phase 3 | Prometheus/Grafana or cheap SaaS, OpenTelemetry traces for MCP + sync, error tracking (Sentry-lite) |

---

*End of Monitoring.*
