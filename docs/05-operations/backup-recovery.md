# Backup & Recovery — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-09 |
| **Related documents** | [Deployment Runbook](deployment-runbook.md) · [Monitoring](monitoring.md) · [Incident Response](incident-response.md) |

---

## 1. What We Protect

| Asset | Where | RPO (recovery point) | RTO (recovery time) |
|---|---|---|---|
| Postgres (users + project JSONB state) | Managed/container DB | **24h** (daily dump) | < 2h |
| App config/secrets | `.env`, provider env | Immediate (recreate) | < 30 min |
| Source code | Git remote | Continuous | < 15 min |

**Targets (V1):** RPO ≤ 24h, RTO ≤ 2h. Tighter RPO (hourly) is a Phase 2 option via pgBackRest or continuous WAL archiving.

---

## 2. Backup Methods

### 2.1 Postgres logical dump (primary)

```bash
pg_dump --no-owner --no-privileges -Fc "$DATABASE_URL" > devhub_$(date +%F).dump
```

- Compressed custom format (`-Fc`) — restorable selectively, smallest size.
- Run daily at 02:00 UTC via cron/systemd timer (`[VPS]`) or provider snapshot (`[Railway]/[Render]` managed snapshots).

### 2.2 JSON export snapshots (secondary, app-level)

The export feature (`GET /api/projects/:id/export`) produces human-readable, version-independent backups:

```bash
# daily per project (loop over project ids)
curl -s -b cookies.txt http://localhost:3000/api/projects/$id/export -o export_$id_$(date +%F).json
```

**Why both:** the JSON export survives app version changes and can be re-imported into a fresh DB; the pg dump is the complete restore path (users + sessions + everything).

---

## 3. Backup Storage & Retention

| Policy | Value |
|---|---|
| Storage | Encrypted object storage (Backblaze B2 / S3 / rsync to second disk) |
| Encryption | At-rest provider-side; never store DB dumps on the app disk |
| Retention | Daily × 14, weekly × 8, monthly × 12 |
| Offsite | Mandatory — a backup on the same server is not a backup |

---

## 4. Restore Procedures

### 4.1 Restore full database

```bash
# 1. Stop app (avoid writes during restore)
docker stop devhub

# 2. Recreate empty DB
createdb devhub_restore

# 3. Restore dump
pg_restore --no-owner -d "$DATABASE_URL" devhub_YYYY-MM-DD.dump

# 4. Start app, verify health + login
docker start devhub
curl http://localhost:3000/api/health
```

### 4.2 Restore single project from JSON export

```http
POST /api/projects/p-1/import
```

Requires the project row to exist (recreate via `POST /api/projects` if it was deleted). The `state` passes the same zod validation as normal writes.

---

## 5. Recovery Drill (quarterly — mandatory)

1. Spin up a scratch DB (docker compose `devhub-test`).
2. Restore the most recent dump.
3. Verify: count users/projects match expectations; login works; open a project; export round-trip.
4. Log the drill in this document's table below.

| Date | Restored from | Result | Notes |
|---|---|---|---|
| *(to be filled at Phase 2)* | | | |

---

## 6. Backup Verification

- After every backup run: check exit code, dump size > 0, and `pg_restore --list` parses the file.
- Alert on failure: monitoring hook (see [Monitoring](monitoring.md) §3).

---

## 7. Data Loss Scenarios → Responses

| Scenario | Response |
|---|---|
| Accidental project deletion | Restore from JSON export (24h window) or pg dump |
| DB corruption | pg dump restore (may lose ≤ 24h of changes) |
| Whole-server loss | Offsite pg dump + JSON exports + git repo → fresh deploy (RTO < 2h) |
| Partial state corruption (bad import) | Reimport previous export; investigate before accepting |

---

*End of Backup & Recovery.*
