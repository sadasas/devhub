# Backup & Recovery — DevHub

| Field | Value |
|---|---|
| **Document status** | Active (Phase 2) |
| **Version** | 2.1 |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-24 |
| **Related documents** | [Deployment Runbook](deployment-runbook.md) · [Monitoring](monitoring.md) · [Incident Response](incident-response.md) |

---

## 1. What We Protect

| Asset | Where | RPO (recovery point) | RTO (recovery time) |
|---|---|---|---|
| Postgres (users + project JSONB state, termasuk whiteboard embed SVG inline tersanitasi) | Neon (prod, direct string) | **24h** (daily dump) | < 2h |
| Supabase Storage bytes (bucket `devhub-attachments` — isi file lampiran) | Supabase Storage | **24h** (inventaris + kebijakan retensi §3; bytes BUKAN di pg dump) | < 2h (re-upload / restore dari versioning bila aktif) |
| App config/secrets | `.env`, Suga `cuddly-hawk` env | Immediate (recreate) | < 30 min |
| Source code | Git remote | Continuous | < 15 min |

**Targets (V1):** RPO ≤ 24h, RTO ≤ 2h. Tighter RPO (hourly) is a Phase 2 option via pgBackRest or continuous WAL archiving.

---

## 2. Backup Methods

> **⚠️ Ad-hoc DB scripts must never target the dev DB.** The pool reads `DATABASE_URL` (dev, :5432); the test DB (`DATABASE_URL_TEST`, :5433) is only selected inside the vitest bootstrap (`vitest.config.ts`). Any standalone script that imports `server/src/db/pool.ts` runs against **dev**. Before any destructive query from a script: set `NODE_ENV=test` + `DATABASE_URL_TEST` (or override `DATABASE_URL`) **before** importing the pool, and assert the resolved DB name ends with `_test`. Prefer reusing `server/test/setup.ts resetDb()` inside vitest when possible.

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
| Storage (DB dumps + JSON exports) | Encrypted object storage (Backblaze B2 / S3 / rsync to second disk) |
| Supabase Storage bytes (lampiran) | Retensi mengikuti kebijakan bucket Supabase: hapus di app = hapus bytes (`removeObject` best-effort); hapus task/issue/project = hapus semua bytes terkait; JSON export HANYA membawa metadata lampiran (nama/tipe/size/link), bukan bytes — restore bytes butuh bucket utuh |
| Whiteboard embed SVG | Inline di project JSONB (sudah tersanitasi allowlist) → ikut pg dump + JSON export; tidak ada store bytes terpisah |
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
curl http://localhost:3000/api/v1/health
```

### 4.2 Restore single project from JSON export

```http
POST /api/projects/p-1/import
```

Requires the project row to exist (recreate via `POST /api/projects` if it was deleted). The `state` passes the same zod validation as normal writes.

---

## 5. Recovery Drill (quarterly — mandatory)

> **Phase 2 Aktif (2026-09-13):** drill wajib tiap kuartal ke scratch DB terpisah.
> Jangan restore ke DB produksi. Gunakan `DATABASE_URL_SCRATCH` (Neon branch
> atau `docker compose` service `devhub-test`).

### 5.1 Langkah drill standar

1. Spin up a scratch DB (docker compose `devhub-test`) atau Neon branch kosong.
2. Restore dump terbaru ke scratch DB:

```bash
# 1. Buat DB scratch kosong (contoh lokal)
createdb devhub_scratch

# 2. Restore dump terbaru (ganti tanggal)
pg_restore --no-owner -d "$DATABASE_URL_SCRATCH" /mnt/offsite/devhub/devhub_2026-09-13.dump

# 3. Verifikasi hitung users/projects
psql "$DATABASE_URL_SCRATCH" -c "SELECT count(*) AS users FROM users;"
# expected: count >= 1 (sesuai data produksi saat dump)

psql "$DATABASE_URL_SCRATCH" -c "SELECT count(*) AS projects FROM projects;"
# expected: count >= 0, cocok dengan jumlah sebelum drill

# 4. Verifikasi app-level (arahkan BE sementara ke scratch ATAU inspeksi data):
#    a. login works — login via UI/API ke BE yang menunjuk scratch, dapat 200 + cookie devhub_session
#    b. open a project — GET /api/v1/projects/:id → 200
#    c. export round-trip — GET /api/projects/:id/export → simpan JSON → POST /api/projects/import → restored:true
```

```bash
# contoh verifikasi login + open project + export (BE menunjuk scratch di :3000)
curl -s -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"ops-drill@example.com","password":"Drill123!"}' \
  http://localhost:3000/api/v1/auth/login
# expected: {"id":"...","email":"ops-drill@example.com"}

curl -s -b cookies.txt http://localhost:3000/api/v1/projects | head -c 200
# expected: {"projects":[...]}

curl -s -b cookies.txt http://localhost:3000/api/projects/$PROJECT_ID/export -o /tmp/drill_export.json
# expected: file > 0 byte — validasi JSON: jq . /tmp/drill_export.json >/dev/null && echo "export JSON valid"
```

3. Verifikasi: count users/projects match expectations; login works; open a project; export round-trip.
4. Log the drill in this document's table below.

| Date | Restored from | Result | Notes |
|---|---|---|---|
| 2026-09-24 (nyata) | `devhub_2026-09-24.dump` (offsite B2) → `devhub_scratch` (Neon branch) | PASS | Drill nyata Sep-2026: users/projects cocok dengan prod saat dump, login OK (`devhub_session` HttpOnly Lax), open project OK, export→import `restored:true` termasuk board whiteboard embed SVG (render utuh, tanpa tag ter-strip). Operator: Project Owner. Durasi ±18 mnt. |

---

## 6. Backup Verification

- After every backup run: check exit code, dump size > 0, and `pg_restore --list` parses the file.
- Alert on failure: monitoring hook (see [Monitoring](monitoring.md) §3).

---

## 7. Data Loss Scenarios → Responses

| Scenario | Response |
|---|---|
| Accidental project deletion | Restore from JSON export (24h window) or pg dump (embed SVG ikut; bytes lampiran TIDAK ikut — re-upload manual) |
| Lampiran terhapus tapi metadata masih ada | Re-upload file ke task/issue terkait; bytes Supabase tidak bisa direkonstruksi dari JSON export |
| DB corruption | pg dump restore (may lose ≤ 24h of changes) |
| Whole-server loss | Offsite pg dump + JSON exports + git repo → fresh deploy (RTO < 2h) |
| Partial state corruption (bad import) | Reimport previous export; investigate before accepting |

---

## 8. Phase 2 Aktif — Cron Offsite + Retensi + Alert (2026-09-13)

> Status: **Aktif**. Cron jalan dari host eksternal, BUKAN dari container Suga
> (disk Suga free hanya 1 GB + ephemeral — backup di disk yang sama bukan backup).

### 8.1 Skrip operasional

| Skrip | Fungsi |
|---|---|
| `ops/backup.sh` | `pg_dump --no-owner --no-privileges -Fc "$DATABASE_URL"` → `$BACKUP_DIR/devhub_YYYY-MM-DD.dump` (offsite). Verifikasi size > 0 + `pg_restore --list`. Gagal → ntfy `devhub-alerts`. Sukses → panggil prune. |
| `ops/prune-backups.sh` | Retensi Daily × 14 / weekly × 8 (Minggu, ≤ 56 hari) / monthly × 12 (tgl 01, ≤ 365 hari). `DRY_RUN=1` untuk simulasi. |

Aturan offsite:

- `BACKUP_DIR` WAJIB mount offsite (mis. `/mnt/offsite/devhub` via rclone ke B2/S3, NAS, atau VPS kedua).
- JANGAN arahkan ke `/tmp`, `/app`, atau volume container Suga.
- `DATABASE_URL` pakai Neon **direct** string, bukan pooled/PgBouncer (advisory lock migrasi pecah di transaction pooling — lihat [Deployment Runbook §5.4](deployment-runbook.md#54-managed-platforms)).

### 8.2 Contoh cron 02:00 UTC

```cron
# /etc/cron.d/devhub-backup — jalan 02:00 UTC tiap hari
0 2 * * * opsuser DATABASE_URL='postgresql://USER:PASS@ep-xxx.neon.tech/dbname?sslmode=require' BACKUP_DIR=/mnt/offsite/devhub /opt/devhub/ops/backup.sh >>/var/log/devhub-backup.log 2>&1
```

Cara pasang:

```bash
chmod +x ops/backup.sh ops/prune-backups.sh
# test manual sekali (tanpa secret asli di git):
DATABASE_URL='postgresql://...' BACKUP_DIR=/mnt/offsite/devhub ./ops/backup.sh
# simulasi prune tanpa hapus:
BACKUP_DIR=/mnt/offsite/devhub DRY_RUN=1 ./ops/prune-backups.sh
# pasang cron:
crontab -e
# tempel baris 0 2 * * * di atas (sesuaikan path /opt/devhub)
crontab -l | grep devhub
# expected: baris cron tampil
```

### 8.3 Alert on failure → ntfy

- Topik: `ntfy.sh/devhub-alerts` (sama dengan [Monitoring](monitoring.md#4-alerting)).
- `ops/backup.sh` kirim otomatis saat gagal:

```bash
curl -sS --max-time 15 -H "Title: DevHub backup FAILED 2026-09-13" -H "Tags: rotating_light" \
  -d "pg_dump exit non-zero (host: backup-01, dir: /mnt/offsite/devhub)" \
  https://ntfy.sh/devhub-alerts
# expected: 200 OK (atau JSON id pesan); cek di aplikasi ntfy / web https://ntfy.sh/devhub-alerts
```

- Test manual ntfy (tanpa picu backup gagal):

```bash
curl -d "test backup alert $(date -u +%FT%TZ)" ntfy.sh/devhub-alerts
# expected: {"id":"...","topic":"devhub-alerts",...} + notifikasi muncul di subscriber devhub-alerts
```

- Jika tidak ada alert 24 jam setelah jadwal → anggap cron mati, cek `/var/log/devhub-backup.log` + `systemctl status cron` (lihat [Incident Response](incident-response.md)).

---

*End of Backup & Recovery.*
