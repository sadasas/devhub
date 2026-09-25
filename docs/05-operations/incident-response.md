# Incident Response — DevHub

| Field | Value |
|---|---|
| **Document status** | Active (Phase 2) |
| **Version** | 2.1 |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-24 |
| **Related documents** | [Monitoring](monitoring.md) · [Backup & Recovery](backup-recovery.md) · [Security Design](../02-architecture/security-design.md) |

---

## 1. Scope & Model

Solo operation: the operator is on-call 24/7. This document defines **what counts as an incident, how to respond, and how to learn**. No pagers — alerting lands on the phone via ntfy (see [Monitoring](monitoring.md)).

---

## 2. Severity Matrix

| Sev | Definition | Example | Response time | Communication |
|---|---|---|---|---|
| **SEV-1** | Data loss or confirmed security breach | DB compromised, accounts leaked, ransomware | Immediate (< 1h) | Stop service → investigate → notify users |
| **SEV-2** | Service down / degraded for users | 503s, login broken, MCP down | < 4h | Fix → postmortem |
| **SEV-3** | Partial issue, non-blocking | Slow state save, chart rendering bug | < 24h | Fix in normal cycle |
| **SEV-4** | Cosmetic / no user impact | Typo, styling glitch | Next release | Normal backlog |

---

## 3. Incident Response Process

### 3.1 Detect & Triage (T-0)

1. Alert fires (ntfy) or user reports.
2. Confirm: check `/api/v1/health`, provider dashboard, error logs.
3. Assign severity per matrix. **SEV-1/2 → stop work, start incident timer.**

### 3.2 Stabilize (T-0 → T-+1h)

| Step | Action |
|---|---|
| 1 | **Preserve evidence** (SEV-1): snapshot logs, DB dump before any action |
| 2 | Stop the bleeding: take the service down if data is at risk (`docker stop devhub`) |
| 3 | Quickest safe fix: rollback app (previous image) or restore DB ([Backup & Recovery §4](backup-recovery.md#4-restore-procedures)) |
| 4 | Verify recovery: health OK, login OK, data intact |

### 3.3 Diagnose (after stabilization)

- Root-cause from logs (structured JSON lines, grep by time window).
- For security incidents: check auth logs, rate-limit hits, MCP access logs (`oauth_access_tokens.expires_at` / `oauth_clients`); rotate `JWT_SECRET`, revoke exposed OAuth clients (`DELETE /oauth/authorized-apps/:clientId` or `POST /oauth/revoke`), rotate DB credentials.
- Never jump to conclusions; write findings in the postmortem.

### 3.4 Resolve & Recover

- Apply permanent fix (code/hardening), test, release per [Deployment Runbook](deployment-runbook.md) §8.
- For SEV-1: after recovery, change every secret; audit data for tampering.

---

## 4. Communication

| Audience | What | How |
|---|---|---|
| Users (Phase 2+) | Service status, data-loss notifications | Status page + email if accounts exist |
| Self | Incident log | This document's log table |

**SEV-1 mandatory:** inform affected users within 24h (privacy obligations per [Privacy Policy](../06-compliance/privacy-policy.md)).

### 4.1 Channel SEV-1 (Phase 2 Aktif 2026-09-13)

| Channel | Alamat / topik | Kapan dipakai |
|---|---|---|
| Email operator | `support@devhub.nrawangbatin.my.id` (ganti dengan email owner asli saat go-live; placeholder ini WAJIB diganti sebelum broadcast) | Semua SEV-1/2: notifikasi user + thread postmortem |
| ntfy push | `ntfy.sh/devhub-alerts` (sama dengan [Monitoring](monitoring.md#41-topik-ntfy-devhub-alerts--lima-alert-wajib-phase-2-sep-2026)) | Deteksi + update cepat (< 5 mnt): `SEV-1 DETECTED`, `SEV-1 MITIGATED`, `SEV-1 RESOLVED` |
| Log insiden | Tabel §6 dokumen ini | Setiap update T-0 / T+1h / resolved |

Contoh kirim update cepat via ntfy:

```bash
curl -sS -H "Title: SEV-1 DETECTED devhub" -H "Tags: rotating_light" \
  -d "Login 503 sejak $(date -u +%FT%TZ), mulai rollback BE (lihat §4.3)" \
  https://ntfy.sh/devhub-alerts
# expected: 200 OK + push di subscriber devhub-alerts
```

### 4.2 Template notifikasi 24 jam (Bahasa Indonesia, SEV-1)

> Wajib kirim ≤ 24 jam ke semua pengguna terdampak via email `support@devhub.nrawangbatin.my.id`.
> Jangan hapus baris mana pun — isi `[...]` lalu kirim.

```text
Subjek: [SEV-1] Pemberitahuan insiden DevHub — [RINGKASAN 1 BARIS] ([TANGGAL UTC])

Halo pengguna DevHub,

Kami mengalami insiden pada layanan DevHub pada [TANGGAL + JAM UTC, mis. 2026-09-13 03:10 UTC].

Apa yang terjadi:
[2–3 kalimat: mis. database tidak dapat diakses sehingga login gagal 03:10–03:40 UTC.]

Dampak untuk Anda:
[mis. tidak bisa login/menyimpan 30 menit; TIDAK ada indikasi kebocoran password (bcrypt) / ATAU data berikut terdampak: ...]

Data Anda:
[mis. tidak ada data hilang (RPO 24h terpenuhi, restore dari dump 02:00 UTC) / ATAU maksimal ... jam perubahan hilang.]

Yang sudah kami lakukan:
1. [mis. rollback BE ke tag vX.Y.Z + verifikasi /health ok]
2. [mis. rotasi JWT_SECRET + revoke OAuth clients bila keamanan]
3. [mis. drill restore ke scratch + monitoring 15 menit hijau]

Yang perlu Anda lakukan:
[Tidak ada / Silakan login ulang / Ganti password di Profile → Security]

Kontak:
Balas email ini (support@devhub.nrawangbatin.my.id) bila ada data yang janggal.
Postmortem menyusul maksimal 5 hari kerja.

— Operator DevHub ([NAMA], [TANGGAL])
```

### 4.3 Uji rollback (wajib sebelum go-live + tiap rilis besar)

Rujukan prosedur: [Deployment Runbook §9](deployment-runbook.md#9-rollback).
Cookie sesi tetap `SameSite=Lax` first-party via Worker proxy
(`app/src/worker.ts` + `server/src/shared/cookie.ts`) — rollback TIDAK mengubah
cookie ke `None`; jangan verifikasi `SameSite=None`.

| Lapisan | Uji rollback | Perintah / klik | Expected |
|---|---|---|---|
| BE (Suga) | Redeploy tag sebelumnya | Suga dashboard → Container → Deployments → pilih tag `vX.Y.(Z-1)` → Redeploy; ATAU `docker build -t devhub:<tag-lama> .` + redeploy. Lalu `curl -sS https://devhub.nrawangbatin.my.id/api/v1/health` | `{"status":"ok","db":"connected",...}` ≤ 3 mnt; login OK; `Set-Cookie: devhub_session=...; Path=/; HttpOnly; SameSite=Lax` (cek `curl -sSI`) |
| FE (Workers) | Rollback instan | Cloudflare dashboard → Workers & Pages → `devhub-app` → Deployments → history → **Rollback** ke versi sebelumnya (tanpa rebuild) | SPA versi lama tayang ≤ 60 dtk; hard-refresh Incognito tampil; `/api/v1/health` tetap ok |
| DB (bila migrasi rusak) | Restore pre-release backup | `pg_restore --no-owner -d "$DATABASE_URL_SCRATCH_DULU"` drill dulu, baru produksi (lihat [Backup & Recovery §4](backup-recovery.md#4-restore-procedures)) | Count users/projects cocok; export round-trip `restored:true` |

Checklist uji:

- [ ] BE redeploy tag lama → health ok + login ok
- [ ] FE Workers rollback → versi lama tayang instan
- [ ] ntfy `devhub-alerts` terima `ROLLBACK OK` dari operator
- [ ] Hasil dicatat di tabel §6 (kolom Actions)

---

## 5. Postmortem Template

```
## Postmortem — <incident id>

- **Date / duration:** ...
- **Severity:** SEV-x
- **Summary (3 sentences max):** ...
- **Impact:** ...
- **Root cause:** ...
- **Timeline:** T-0 detection ... actions ...
- **What went well:** ...
- **What went wrong:** ...
- **Action items:** [ ] fix  [ ] test  [ ] docs  [ ] monitoring
- **Follow-up date:** ...
```

---

## 6. Incident Log

| ID | Date | Sev | Summary | Root cause | Actions |
|---|---|---|---|---|---|
| INC-2026-09-A | 2026-09 (Sep) | SEV-3 | Upload lampiran TUS gagal massal: Supabase 403 `Invalid Compact JWS` di endpoint resumable | Token presign di-sign **tanpa** `upsert` (`createSignedUpload` default `upsert=false`) tetapi upload TUS mengirim header `x-upsert` — token mengikat opsi path sehingga Supabase menolak 403. Dampak: resumable upload gagal; fallback PUT satu-request tetap jalan | Sign TUS presign dengan `upsert=true` (`mintTusPresigned`, `storageClient.ts`); pertahankan fallback PUT via signed `uploadUrl`; monitor alert #4 storage-403 ([Monitoring §3.1.1](monitoring.md)) |
| INC-2026-09-B | 2026-09 (Sep) | SEV-3 | `pool-timeout` intermiten di `requireAuth`/`verifySession`: login/`/auth/me` gagal berkala + `/health` 503 sesaat | `pg-pool` jenuh sesaat di Suga `cuddly-hawk` (`PG_POOL_MAX=6`, idle 30s, connection timeout 5s, `statement_timeout=30s`): `verifySession` (`jwt.ts`) query `users.jwt_version` ikut antre di belakang query lambat; Neon cold-start memperparah | Retry sisi klien untuk auth gagal sesaat; jaga `PG_POOL_MAX=6` + query ringan; monitor alert #5 pool-timeout ([Monitoring §3.1.2–3.1.3](monitoring.md)); playbook §6.1.2 |

---

## 6.1 Playbook Sep-2026 (storage-403 & pool-timeout)

### 6.1.1 Storage-403 TUS upsert mismatch

1. **Deteksi:** ntfy alert #4 ATAU grep `Object storage request failed.*403` ([Monitoring §3.1.1](monitoring.md)).
2. **Konfirmasi:** `POST /api/v1/attachments/presign` → upload TUS dengan header `x-upsert` → reproduksi 403 `Invalid Compact JWS`; cek log server ada `status:403` dari `storageClient.ts`.
3. **Mitigasi cepat:** arahkan user ke **fallback PUT** (`uploadUrl` satu-request) — tidak butuh header `x-upsert`, tetap jalan selama sign OK.
4. **Fix permanen:** pastikan `mintTusPresigned` memanggil `createSignedUpload(key, 7200, true)` — nilai `upsert` saat sign HARUS sama dengan header `x-upsert` saat upload.
5. **Verifikasi:** upload TUS kecil OK + fallback PUT OK + grep 403 NOL dalam 30 menit; catat di tabel §6.

### 6.1.2 Pool-timeout requireAuth/verifySession

1. **Deteksi:** ntfy alert #5 ATAU grep pool `timeout` + latency `requireAuth` ([Monitoring §3.1.2–3.1.3](monitoring.md)) + `/health` 503 berkala.
2. **Konfirmasi:** `SELECT count(*) FROM pg_stat_activity;` vs `PG_POOL_MAX=6`; cek Suga `cuddly-hawk` logs: timeout di `verifySession` (`users.jwt_version`), bukan kredensial salah (401 biasa tetap 401, bukan timeout).
3. **Mitigasi cepat:** retry 1× sisi klien untuk auth gagal sesaat; jangan restart DB membabi-buta; bila jenuh (> 6 koneksi aktif lama) identifikasi query lambat (`statement_timeout=30s` seharusya memutusnya).
4. **Fix permanen:** pertahankan `PG_POOL_MAX=6`, `idleTimeoutMillis=30000`, `connectionTimeoutMillis=5000` (`server/src/db/pool.ts`); pakai Neon **direct** string (bukan pooled); jaga query auth tetap 1 PK lookup.
5. **Verifikasi:** login + `/auth/me` 200 tiga kali beruntun + `/health` 200 + grep timeout NOL dalam 30 menit; catat di tabel §6.

---

## 7. Prevention Checklist (monthly)

- [ ] Backup drill executed (quarterly at minimum)
- [ ] `npm audit` clean; patches applied
- [ ] Secrets rotated per schedule
- [ ] Rate-limit counters reviewed for abuse patterns
- [ ] Postmortems action items closed

---

*End of Incident Response.*
