# Monitoring & Observability — DevHub

| Field | Value |
|---|---|
| **Document status** | Active (Phase 2) |
| **Version** | 2.1 |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-24 |
| **Related documents** | [Deployment Runbook](deployment-runbook.md) · [Incident Response](incident-response.md) · [Security Design](../02-architecture/security-design.md) |

---

## 1. Principles

- **Minimal, meaningful, cheap.** Solo ops: one health endpoint, structured logs, one alert channel (ntfy/email). No metrics platform until Phase 3.
- Health = app process + database reachability.
- Logs = errors + auth events + slow requests; never secrets.

---

## 2. Health Checks

### 2.1 Endpoint

`GET /api/v1/health` → 200:

```json
{ "status": "ok", "db": "connected", "uptime": 12345.6 }
```

- `db` checks `SELECT 1` on the pool.
- `503` when DB unreachable → triggers the uptime monitor.

### 2.2 Uptime monitoring

| Option | Notes |
|---|---|
| UptimeRobot (free tier) | HTTP check every 5 min on `/api/v1/health` |
| Better Stack / Healthchecks.io | Optional; keep one provider |
| **Choice (Phase 2)** | UptimeRobot free tier |

Alert target: ntfy.sh topic (push to phone) and/or email.

#### 2.2.1 Setup UptimeRobot free 5-menit (Phase 2 Aktif 2026-09-13)

> Status: **Aktif**. Satu monitor untuk domain publik via Worker proxy
> (same-origin, cookie `SameSite=Lax` — bukan `None`, lihat `server/src/shared/cookie.ts`
> + `app/src/worker.ts` dan [Deployment Runbook §6](deployment-runbook.md#6-environment-variables)).

1. Login ke [uptimerobot.com](https://uptimerobot.com) (free plan) → **Add New Monitor**.
2. Isi persis:

| Field | Value |
|---|---|
| Monitor Type | HTTP(s) |
| Friendly Name | `devhub-prod-health` |
| URL | `https://devhub.nrawangbatin.my.id/api/v1/health` |
| Monitoring Interval | `5 minutes` (maksimal free tier) |
| Monitor Timeout | `30` detik |
| Keyword check (opsional tapi disarankan) | Keyword `ok`, Alert when keyword `not exists` — memastikan body mengandung `"status":"ok"` |

3. Alert Contact → tambah **ntfy**:
   - UptimeRobot free tidak punya native ntfy — pakai **Webhook** ke ntfy ATAU email → forward ke ntfy.
   - Opsi A (disarankan, tanpa server tambahan): Alert Contact Type `E-mail` ke alamat yang diforward, PLUS langganan topik `devhub-alerts` di HP via aplikasi ntfy.
   - Opsi B (webhook langsung): Alert Contact Type `Web-Hook`, URL `https://ntfy.sh/devhub-alerts`, POST Value `{"topic":"devhub-alerts","title":"UptimeRobot DOWN","message":"Monitor *%monitorFriendlyName* is *%alertTypeFriendlyName*","tags":["rotating_light"]}` — sesuaikan placeholder UptimeRobot (`*monitorURL*`, `*alertDetails*`).
4. Aktifkan alert untuk **down + up (recovery)** agar tahu MTTR.
5. Verifikasi: matikan BE sementara ATAU pakai URL salah satu kali → pastikan ntfy `devhub-alerts` bunyi dalam ≤ 5–10 menit (lihat §7 Verifikasi).

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

### 3.1 Pola log/grep Sep-2026 (storage + pool + embed)

> Pola nyata dari insiden Sep-2026 (lihat [Incident Response §6](incident-response.md#6-incident-log)).
> Semua pola di bawah untuk log Suga (`cuddly-hawk`) — JSON lines.

```bash
# 1. storage-403 upsert mismatch (sign tanpa upsert vs header x-upsert; TUS resumable)
# Server log: warn "Object storage request failed" {status:403,...} di storageClient.ts
grep -E 'Object storage request failed.*"(status)":403' app.log | tail -20
# expected bila insiden: baris 403 beruntun saat presign TUS; setelah fix: NOL 403 (fallback PUT 200)

# 2. pool-timeout di requireAuth/verifySession (pg-pool intermiten, max PG_POOL_MAX=6)
grep -E 'pool.*(timeout|Timeout)|connectionTimeout|verifySession|requireAuth' app.log | tail -20
# expected bila insiden: "timeout" + latency requireAuth melonjak + /health 503 berkala; setelah tuning: hilang

# 3. pool wait/count (antrean koneksi — bedakan jenuh vs timeout sesaat)
grep -E '"(pool|pg|db)".*(wait|waiting|count|total|idle)' app.log | tail -20
# + cek DB langsung: SELECT count(*) FROM pg_stat_activity;  -- expected: < PG_POOL_MAX (6 di Suga)

# 4. kuota storage (bucket devhub-attachments — cegah upload gagal massal)
# cek dari dashboard Supabase Storage (bucket size vs kuota proyek) tiap minggu;
# di log: grep STORAGE_UNAVAILABLE / STORAGE_DISABLED
grep -E 'STORAGE_UNAVAILABLE|STORAGE_DISABLED|storage.*(quota|limit|exceed)' app.log | tail -20
# expected normal: kosong; bila kuota penuh: 503 STORAGE_UNAVAILABLE beruntun

# 5. whiteboard embed error (SVG embed — sanitasi allowlist / embed gagal render)
grep -E 'embed.*(strip|sanitiz|fail|invalid)|whiteboard.*embed' app.log | tail -20
# expected normal: kosong; bila ada: cek board id + payload SVG yang di-strip
```

---

## 4. Alerting

| Alert | Trigger | Action |
|---|---|---|
| Site down | health check fails ×3 | UptimeRobot → ntfy push |
| Backup failed | cron exit code ≠ 0 | ntfy push (see [Backup & Recovery](backup-recovery.md) §6) |
| Auth abuse | rate-limit hits spike | Manual log review; consider IP block |
| High error rate | `ERROR` count > threshold/5min | Investigate logs |
| Storage-403 | `Object storage request failed` status 403 beruntun (pola §3.1.1) | ntfy push → cek sign `upsert` vs header `x-upsert`, verifikasi fallback PUT (lihat [Incident Response](incident-response.md)) |
| Pool-timeout | pool timeout / `requireAuth` latency + `/health` 503 berkala (pola §3.1.2–3.1.3) | ntfy push → cek `pg_stat_activity` vs `PG_POOL_MAX=6`, retry + tuning pool |

Single channel: **ntfy.sh** topic `devhub-alerts` (free, privacy-friendly, aligns with the privacy-first philosophy).

### 4.1 Topik ntfy `devhub-alerts` — lima alert wajib Phase 2 (Sep-2026)

| # | Alert | Sumber | Pesan ntfy (contoh Title) |
|---|---|---|---|
| 1 | **down** | UptimeRobot §2.2.1 | `🔴 devhub DOWN — /api/v1/health gagal` |
| 2 | **backup-failed** | `ops/backup.sh` (lihat [Backup & Recovery §8.3](backup-recovery.md#83-alert-on-failure--ntfy)) | `DevHub backup FAILED 2026-09-13` |
| 3 | **error-rate** | Review log manual Phase 2 (`ERROR` > 20/5 mnt ATAU 503 beruntun) → kirim manual/AI-agent via curl di bawah | `⚠️ devhub error-rate tinggi` |
| 4 | **storage-403** | Grep §3.1.1 (`Object storage request failed` 403 beruntun, TUS presign) → kirim manual via curl | `⚠️ devhub storage-403 (TUS upsert mismatch)` |
| 5 | **pool-timeout** | Grep §3.1.2–3.1.3 (pool timeout / `requireAuth` + 503 berkala) → kirim manual via curl | `⚠️ devhub pool-timeout (requireAuth/verifySession)` |

Kirim error-rate manual saat investigasi:

```bash
curl -sS -H "Title: devhub error-rate tinggi" -H "Tags: warning" \
  -d "ERROR > 20/5min di $(date -u +%FT%TZ), cek Suga logs + Neon" \
  https://ntfy.sh/devhub-alerts
# expected: 200 OK + notifikasi di subscriber devhub-alerts
```

Semua subscriber WAJIB subscribe topik `devhub-alerts` di aplikasi ntfy (Android/iOS) atau `https://ntfy.sh/devhub-alerts` di browser.

Kirim storage-403 / pool-timeout manual saat investigasi (§3.1):

```bash
curl -sS -H "Title: devhub storage-403 (TUS upsert mismatch)" -H "Tags: warning" \
  -d "403 beruntun di presign TUS $(date -u +%FT%TZ), cek sign upsert vs x-upsert + fallback PUT" \
  https://ntfy.sh/devhub-alerts
# expected: 200 OK + notifikasi di subscriber devhub-alerts

curl -sS -H "Title: devhub pool-timeout (requireAuth/verifySession)" -H "Tags: warning" \
  -d "pool timeout beruntun $(date -u +%FT%TZ), cek pg_stat_activity vs PG_POOL_MAX=6 (Suga cuddly-hawk)" \
  https://ntfy.sh/devhub-alerts
# expected: 200 OK + notifikasi di subscriber devhub-alerts
```

---

## 5. Key Metrics (manual review cadence)

| Metric | Where | Cadence |
|---|---|---|
| Health uptime | UptimeRobot dashboard | Weekly glance |
| Error count + top 5 errors | Provider log search | Weekly |
| DB size, growth | `SELECT pg_size_pretty(...)` | Monthly |
| Active users (self) | `/api/auth/me` + log lines | Monthly |
| Backup success/failure | Cron log + drill table | Monthly |
| Storage quota (bucket `devhub-attachments`) | Supabase dashboard + grep §3.1.4 | Weekly |
| Storage-403 count (TUS presign) | Provider log search §3.1.1 + alert #4 | Weekly |
| Pool timeout / wait (requireAuth) | Provider log search §3.1.2–3.1.3 + alert #5 | Weekly |
| Whiteboard embed errors | Provider log search §3.1.5 | Monthly |

---

## 6. Instrumentation Plan by Phase

| Phase | Adds |
|---|---|
| V1 (now) | Health endpoint, structured JSON logs, backup alert hook |
| Phase 2 | UptimeRobot, ntfy alerting, request-duration logging |
| Phase 3 | Prometheus/Grafana or cheap SaaS, OpenTelemetry traces for MCP + sync, error tracking (Sentry-lite) |

---

## 7. Verifikasi Phase 2 (wajib sebelum go-live)

### 7.1 curl health — expect `{"status":"ok"}`

```bash
curl -sS https://devhub.nrawangbatin.my.id/api/v1/health
# expected (200, berisi "status":"ok"):
# {"status":"ok","db":"connected","uptime":12345.6}
```

```bash
# verifikasi ketat: status HTTP 200 + keyword ok
curl -sS -o /tmp/health.json -w "%{http_code}\n" https://devhub.nrawangbatin.my.id/api/v1/health
# expected: 200
cat /tmp/health.json
# expected: {"status":"ok","db":"connected","uptime":...}
grep -q '"status":"ok"' /tmp/health.json && echo "HEALTH OK" || echo "HEALTH FAIL"
# expected: HEALTH OK
```

Degraded (DB mati) → `503 {"status":"degraded","db":"unreachable",...}` → UptimeRobot harus alert.

### 7.2 Test ntfy `devhub-alerts`

```bash
curl -d "test monitoring $(date -u +%FT%TZ)" ntfy.sh/devhub-alerts
# expected: {"id":"...","topic":"devhub-alerts",...} + push muncul di HP/browser subscriber
```

```bash
# buka stream untuk memastikan pesan masuk (Ctrl-C untuk keluar):
curl -sN https://ntfy.sh/devhub-alerts/sse
# expected: event terbuka + pesan test di atas tampil sebagai data: ...
```

Checklist verifikasi:

- [ ] `curl /api/v1/health` → 200 + `"status":"ok"` (via proxy `devhub.nrawangbatin.my.id`, cookie Lax first-party)
- [ ] `curl -d ... ntfy.sh/devhub-alerts` → push diterima ≤ 10 detik
- [ ] UptimeRobot dashboard → monitor `devhub-prod-health` hijau, interval 5 min, keyword `ok`
- [ ] Simulasi down (URL salah sementara) → ntfy down masuk
- [ ] `ops/backup.sh` gagal sengaja (`DATABASE_URL=invalid ...`) → ntfy `backup FAILED` masuk

---

*End of Monitoring.*
