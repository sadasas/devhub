# Audit Server & Platform — DevHub

- **Tanggal**: 2026-08-13
- **Lingkup**: `server/` (Express 5 + PostgreSQL), `app/` (React 19 + Vite), `docs/05-operations` + `docs/04-api` — server, deploy, API, keamanan, data integrity
- **Metode**: audit statis 6 peran berurutan — Senior Developer → Backend Architect → Code Reviewer → Database Optimizer → Software Architect → API Platform Engineer
- **Status**: SELESAI — 12/12 temuan ditangani (1 critical, 4 high, 5 medium, 2 low) + 1 temuan keamanan pra-ada (issue #14a1950b, rotasi key); semua issue/task di DevHub sudah di-update (resolved/done); verifikasi hijau: server 85/85 test, app 27/27 test

## Ringkasan eksekutif

| Peran | Fokus | Temuan | Critical | High |
| --- | --- | --- | --- | --- |
| Senior Developer | kualitas kode, DX, testing | S6, S7, S9 | — | — |
| Backend Architect | desain sistem, operasional | S1, S8, S9 | S1 | — |
| Code Reviewer | correctness, bugs, race | S2, S10 | — | S2 |
| Database Optimizer | schema, query, integrity | S2, S5, S8 | — | S5 |
| Software Architect | struktur, evolusi | S7, S12 | — | — |
| API Platform Engineer | kontrak, platform | S3, S4, S7 | — | S3, S4 |

**1 Critical (S1 - origin/CORS), 4 High (S2-S5), 5 Medium (S6-S10), 2 Low (S11-S12)**, plus 1 temuan keamanan pra-ada (issue DevHub #14a1950b — API key ter-commit di git history) ditangani di audit keamanan penuh.

---

## Temuan per peran

### Senior Developer

| ID | Severity | Temuan | Keputusan |
| --- | --- | --- | --- |
| S6 | Medium | `server/` tanpa script lint; CI hanya lint `app/`; TS major beda antar workspace (server `^7.0.2` vs app `~6.0.2`) | **DIPERBAIKI**: oxlint + script lint server + step CI; penyetaraan TS major bila build lolos |
| S7 | Medium | Boilerplate transaksi BEGIN/COMMIT/ROLLBACK diulang 4+ file; pola parse-safeParse-400 diulang di semua route; envelope respons tidak konsisten (`{ok:true}` vs `{team:...}` vs bare) | **DIPERBAIKI**: helper `withTransaction` + `parseOrThrow`; unifikasi envelope |
| S9 | Medium | Logging hanya `console.error` tanpa request ID; `/api/health` tidak mencerminkan status DB | **DIPERBAIKI**: logger structured minimal + request ID middleware; health cek DB |

### Backend Architect

| ID | Severity | Temuan | Keputusan |
| --- | --- | --- | --- |
| S1 | Critical | Runbook §2 vs §6 kontradiktif soal static hosting; tidak ada CORS — SPA origin terpisah = semua request gagal | **DIPERBAIKI**: topologi same-origin ditetapkan (proxy `/api` + `/mcp`); middleware `cors` configurable via `CORS_ORIGIN`, default same-origin |
| S8 | Medium | Migrasi otomatis saat boot + CLI = race multi-instance (PK `schema_migrations`); tidak ada prosedur release terpisah | **DIPERBAIKI**: `pg_advisory_lock` di migrasi boot + prosedur release di runbook |
| S9 | Medium | (lihat atas) — health + observability | **DIPERBAIKI** |

### Code Reviewer

| ID | Severity | Temuan | Keputusan |
| --- | --- | --- | --- |
| S2 | High | Lost-update: PUT state read-modify-write tanpa optimistic lock; tab kedua/MCP menimpa data | **DIPERBAIKI**: kolom `projects.version`; PUT=conditional `WHERE version=n` → 409 + `currentState`; frontend banner "muat ulang" |
| S10 | Medium | Ganti password tidak invalidasi sesi lain (JWT stateless, cookie valid 24 jam) | **DIPERBAIKI**: claim `v` (jwt_version) + verifikasi + bump saat ganti password |

### Database Optimizer

| ID | Severity | Temuan | Keputusan |
| --- | --- | --- | --- |
| S5 | High | `mcp_keys.key_hash` tanpa UNIQUE (rows[0] ambigu); role/status/visibility text bebas tanpa CHECK constraint | **DIPERBAIKI**: migrasi 008 — UNIQUE key_hash (dedupe dulu), CHECK pada 4 kolom |
| S2 | High | (lihat atas) — JSONB full-rewrite tanpa versioning | **DIPERBAIKI** |

### Software Architect

| ID | Severity | Temuan | Keputusan |
| --- | --- | --- | --- |
| S7 | Medium | SQL tersebar inline; duplikasi query (3x `SELECT email FROM users` di teams.routes) | **DIPERBAIKI**: dedupe + helper |
| S12 | Low | 18 MCP tool duplikasi pola load→mutate→save full-rewrite | **DIPERBAIKI**: helper mutasi entitas generik + refactor |
| — | — | Keputusan versi API belum diambil | ADR-022 (desain granular API `/api/v1`) |

### API Platform Engineer

| ID | Severity | Temuan | Keputusan |
| --- | --- | --- | --- |
| S3 | High | Tidak ada security headers (helmet) — hanya x-powered-by dimatikan | **DIPERBAIKI**: helmet; CSP diatur kompatibel static-host |
| S4 | High | OpenAPI drift (path import salah, logout 204 vs 200, /teams & /keys tak terdokumentasi, versi mismatch) | **DIHAPUS** (keputusan user): DevHub internal bukan self-hosted — openapi.yaml + api-guide + in-app ApiDocsPage + route `/docs/api` + referensi README/docs dihapus; fitur produk API Docs (collections/endpoints, lib/openapi.ts) **dipertahankan** |
| S7 | Medium | Evelope respons tidak konsisten; tidak ada idempotency | **DIPERBAIKI** (envelope) |

---

## Remediasi — status task

| Batch | Task DevHub | Lingkup | Status |
| --- | --- | --- | --- |
| B1 | #079f4a59 | S1, S3, S5, S2, S10, S9, S11 — CORS+helmet+health/logging+migrasi 008+optimistic lock 409+JWT versioning+runbook | ✅ done |
| B2 | #fd519c90 | S4 — hapus dokumen OpenAPI | ✅ done |
| B3 | #258abd7b | S6, S7, S8 — lint server, helper transaksi/parse, envelope, advisory lock, state GET 500 | ✅ done |
| B4 | #37cc55f9 | S12 — helper mutasi MCP + refactor 18 tools | ✅ done |
| — | #d932d4ab | Audit keamanan penuh (termasuk issue open API key di git history) | ✅ done → `docs/04-audit-security-2026-08.md` |
| — | #e4bac021 | ADR-022 + desain granular API | ✅ done → ADR-022 (Proposed) |

> Catatan: S6 penyetaraan TS major (server `^7.0.2` vs app `~6.0.2`) — **accepted/documented**: kedua build+test lolos, penyetaraan ditolak karena churn tanpa manfaat nyata.

Seluruh issue: `05fca064-6464-4570-ac1d-4155411a0c52` — issues: S1=`a30dcc51`, S2=`db6b30d6`, S3=`a9bbd0f2`, S4=`62115543`, S5=`1e9c1668`, S6=`acd97c46`, S7=`c9357f18`, S8=`c862a7b1`, S9=`f5487908`, S10=`c9869674`, S11=`41d5729d`, S12=`9ac861b2`.