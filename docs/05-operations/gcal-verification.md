# GCal Verification — Integrasi Google Calendar

| Field | Value |
|---|---|
| **Scope** | OAuth + vault, mapping, push worker, UI, playground/E2E (Calendar API saja, tanpa ICS) |
| **Keputusan locked** | Vault per-user · task done = prefix `[Done]` |
| **Milestone** | M30: External Integrations - GCal + GitHub (v0.25.0) |

## 1. Prasyarat

- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` terisi (Google Cloud Console → APIs & Services → Credentials → OAuth client Web).
- Google Calendar API di-Enable (Library) — tanpanya `calendars.insert` 403 `accessNotConfigured`.
- Redirect URI terdaftar: `https://<host>/api/v1/integrations/gcal/callback` (+ `http://localhost:3000/...` untuk dev).
- Scope yang diminta: `https://www.googleapis.com/auth/calendar.app.created` + `access_type=offline&prompt=consent` (least-privilege: buat kalender sekunder + CRUD event di dalamnya; ganti scope = Disconnect + Connect ulang agar token baru membawa scope baru).
- Migrasi `038_gcal.sql` + `039_gcal_reconcile.sql` applied (`npm run db:migrate`).

## 2. Checklist manual

| # | Langkah | Harapan |
|---|---|---|
| 1 | Project settings → Integrations → kartu Google Calendar → Connect | Redirect `accounts.google.com` (scope calendar.app.created, offline, consent, PKCE S256), kembali ke app + toast Connected |
| 2 | Setujui consent di Google | Kembali ke app, badge Connected; `gcal_connections` berisi refresh **terenkripsi** (cek DB: tidak ada token plaintext) |
| 3 | Aktifkan toggle Calendar sync | Kalender `DevHub - <project>` auto-create sekali; `calendar_id` tersimpan; enable ulang tidak bikin duplikat |
| 4 | Buat task dengan due date | Event muncul di Google Calendar hari yang sama |
| 5 | Reschedule (drag) + tandai done | Event ter-patch (tanggal baru, summary prefix `[Done]`); tidak ada event ganda |
| 6 | Hapus due date / hapus task | Event terhapus di Google |
| 7 | Matikan toggle | Tidak ada lagi push (cek outbox kosong) |
| 8 | Disconnect | Token terhapus lokal + revoke best-effort; badge Not connected |
| 9 | Revoke akses dari Google Account (myaccount.google.com → Third-party access) lalu edit task | Banner reconnect muncul (`needs_reconnect`); tidak ada retry buta |

## 3. Kuota & retry

- Simulasikan 429 (mock/stub): op masuk `gcal_outbox`, retry backoff 1m/5m/30m max 5x.
- Trigger manual: `POST /api/v1/integrations/gcal/outbox/process?limit=50` (session cookie).
- Worker in-process tiap 60s (skip saat `NODE_ENV=test`); nonaktifkan via `GCAL_OUTBOX_POLL=false` bila scheduler eksternal dipakai.

## 4. Verifikasi otomatis

```bash
npm run test:server -- gcal   # oauth, vault, mapping, settings, sync, playground
npm run test -- app/src/features/integrations app/src/lib/gcal.test.ts
npm run guard:css              # token compliance UI
npx playwright test e2e/tests/gcal.spec.ts
```

## 5. Rollback

- Disconnect per user menghapus token; `sync_enabled=false` menghentikan push.
- Drop integrasi: hapus 4 tabel gcal_* (data kalender Google tidak tersentuh).
