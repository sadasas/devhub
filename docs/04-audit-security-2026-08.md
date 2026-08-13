# Security Audit 2026-08

- **Tanggal**: 2026-08-13
- **Lingkup**: Server (auth, MCP keys, secrets, headers, rate limit), app, CI/CD, riwayat git
- **Metode**: Review manual kode + config, scan riwayat git (`git log -S`), `npm audit`, pengecekan `.gitignore`/`.env`/CI secrets
- **Status**: Selesai — semua temuan ditindaklanjuti (1 rotasi kredensial, 0 kerentanan dependensi)

---

## Ringkasan

| Area | Hasil |
|---|---|
| Dependensi (`npm audit`) | 0 vulnerability (app & server) |
| Rahasia di `.env` / `.gitignore` | Sehat; `server/.env` di-ignore, `JWT_SECRET` bukan placeholder |
| Rahasia di riwayat git | **1 temuan**: MCP API key literal di `opencode.json` (commit `aac5a5d`) |
| Rahasia di CI workflow | Tidak ada (tidak ada `secrets:` reference) |
| Security headers | Diperbaiki (helmet) di audit server 2026-08 — lihat `docs/04-audit-server-2026-08.md` S3 |
| Rate limiting | Ada global `/api` 300/15min + MCP 120/15min + limiter login/register/password |

---

## Temuan & Tindakan

### SEC-1 — Literal MCP API key ter-commit di riwayat git (kritis, DIPERBAIKI)

**Temuan**: Commit `aac5a5d` (2026-08-10, "chore(config): use literal MCP API key in opencode.json") mengubah value `"Authorization": "Bearer {env:devhub_CnEa62UZyw90pThOq82rQpB0bdbvmR-Bxv6YqnY805U}"` menjadi literal `"Bearer devhub_CnEa62UZyw90pThOq82rQpB0bdbvmR-Bxv6YqnY805U"`. Key tersebut aktif dan dipakai oleh opencode (terakhir digunakan 2026-08-13).

**Tindakan**:
1. **Rotasi key** — key bocor (`mcp_keys` id `34b57710-a6c0-4bd0-87f4-67026318934f`) di-`revoke`; key baru dibuat (`e5c9ab66-64fb-4c59-b2e3-ea2b5a3cb6b2`, prefix `devhub_D`) — raw key baru sudah diberikan di luar dokumen ini.
2. **opencode.json** ditulis ulang memakai env reference: `"Authorization": "Bearer {env:devhub_MCP_KEY}"`.
3. **Catatan** — repo tidak memiliki remote (`git remote -v` kosong), jadi riwayat hanya lokal. Opsional: rewrite history (`git filter-repo`) sebelum repo dipush ke mana pun; karena key sudah dirotasi, risiko sisa minimal.

**Status**: DIPERBAIKI (key dirotasi + config dikembalikan ke env reference).

### SEC-2 — Dependensi (INFO, bersih)

`npm audit --audit-level=high` di app dan server: **0 vulnerability**.

### SEC-3 — Secrets management (INFO, bersih)

- `.gitignore` mencakup `node_modules/`, `dist/`, `build/`, `.env`, `.env.local`, `.env.*.local`, `server/.env`, `logs/`, `coverage/`.
- `server/.env` ada di disk dan di-ignore git; `JWT_SECRET` di dalamnya bukan placeholder (`change-me` tidak ditemukan).
- `.env.example` hanya berisi placeholder aman.

### SEC-4 — CI/CD (INFO, bersih)

`.github/workflows/ci.yml` tidak mereferensikan `secrets:`; hanya variabel `env` biasa. Tidak ada kredensial di workflow.

### SEC-5 — Postur pertahanan yang sudah diperkuat di audit server (2026-08, sama hari)

Untuk konteks lengkap lihat `docs/04-audit-server-2026-08.md`:

- **helmet** aktif: CSP dimatikan *by design* (SPA di-hosting terpisah dengan inline styles), `crossOriginEmbedderPolicy` off, `crossOriginResourcePolicy: cross-origin`, HSTS hanya di production.
- **CORS** default same-origin; enable via `CORS_ORIGIN` (comma-separated, credentials).
- **Body limit** `express.json` 10mb.
- **bcrypt cost 12** untuk password hash.
- **Footgun yang didokumentasikan**: `TRUST_PROXY=true` di depan reverse proxy diperlukan agar rate limit berdasarkan IP client, bukan IP proxy.
- **JWT versioning** (`jwt_version`) — ganti password mematikan semua sesi lain.

---

## Rekomendasi lanjutan (opsional, tidak blokir)

1. Rewrite history sebelum repo dipublikasikan (jika pernah dipush) — key sudah dirotasi, jadi prioritas rendah.
2. Siapkan dependabot/renovate untuk alert CVE rutin.
3. Evaluasi `Content-Security-Policy` ketat saat SPA dan API akhirnya di-hosting bersama origin yang sama.
