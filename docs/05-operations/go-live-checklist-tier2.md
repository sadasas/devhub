# Go-Live Checklist Tier-2 — DevHub

| Field | Value |
|---|---|
| **Document status** | Active (Phase 2 Gate) |
| **Version** | 1.1 |
| **Owner** | Project Owner |
| **Last updated** | 2026-09-24 |
| **Related documents** | [Deployment Runbook](deployment-runbook.md) · [Backup & Recovery](backup-recovery.md) · [Monitoring](monitoring.md) · [Incident Response](incident-response.md) |

> Gate final Tier-2. Semua kotak HARUS ✅ sebelum domain publik diumumkan.
> Prinsip: **verifikasi buta Incognito** — penguji belum login, cache bersih,
> tanpa ekstensi. Cookie sesi adalah `SameSite=Lax` first-party via Worker proxy
> (`app/src/worker.ts` + `server/src/shared/cookie.ts`), BUKAN `SameSite=None`.
> Jangan tempel secret Suga/Neon asli atau GA4 ID asli di dokumen mana pun.

Cara pakai: kerjakan berurutan §1→§8. Tiap item ada **Perintah persis** + **Expected output**.
Tandai `[x]` hanya bila expected terpenuhi persis. Satu FAIL = STOP, catat di §9, perbaiki, ulangi dari §1.

---

## 1. Consent — reject / accept / revoke (Incognito buta)

> Tanpa GA4 ID asli di repo. Ganti `G-XXXX` di bawah dengan ID di Cloudflare build var saat uji lokal saja.

### 1.1 Reject → Network google NOL + localStorage menolak

1. Buka Incognito baru → `https://devhub.nrawangbatin.my.id/` → banner consent muncul.
2. DevTools → Network → filter `google` → klik **Reject/Tolak**.
3. Reload → Network filter `google` tetap kosong. Application → Local Storage → key consent = `denied`/`rejected` (nama key ikut implementasi, mis. `devhub.consent`; yang penting nilainya menolak).

```bash
# verifikasi tidak ada tag GA hardcoded di HTML awal (tanpa JS):
curl -sS https://devhub.nrawangbatin.my.id/ | grep -oiE 'googletagmanager|google-analytics|gtag\.js' || echo "NO-GOOGLE-TAG-IN-HTML"
# expected: NO-GOOGLE-TAG-IN-HTML
```

- [ ] Reject → banner hilang, situs tetap bisa dipakai (login/browse tanpa error)
- [ ] Network `google` = NOL request setelah reject + reload
- [ ] LocalStorage consent = menolak (`denied`/`rejected`/`0`)

### 1.2 Accept → Network google muncul + localStorage menyetujui

1. Incognito baru → **Accept/Setuju** → reload.
2. Network filter `google` → muncul request (`googletagmanager`/`google-analytics`/`collect`).

> Catatan: matikan adblocker/uBlock/Brave Shields/Firefox ETP saat uji ini —
> pemblokir menghentikan `googletagmanager.com` sehingga hasil NOL walau
> implementasi benar. Setelah Accept, app mengirim 1 `page_view` consent-gated
> (`app/src/lib/consent.ts` + `route-tracker.tsx`, path dinormalisasi tanpa
> query) + 1 per navigasi SPA; GA4 Realtime menunjukkan 1 pengguna.

```bash
# verifikasi tidak ada secret bocor di HTML (sanity, bukan ganti Network check):
curl -sS https://devhub.nrawangbatin.my.id/ | grep -oiE 'G-[A-Z0-9]{4,}|DATABASE_URL|JWT_SECRET' || echo "NO-SECRET-IN-HTML"
# expected: NO-SECRET-IN-HTML
```

- [ ] Accept → request google muncul (minimal 1 collect/gtag)
- [ ] LocalStorage consent = menyetujui (`granted`/`accepted`/`1`)

### 1.3 Revoke → kembali NOL

1. Footer/Settings → **Kelola Cookie / Revoke** → pilih Reject lagi → reload.
2. Network `google` kembali NOL.

- [ ] Revoke → Network `google` NOL lagi + LocalStorage kembali menolak
- [ ] Acceptance §1: reject=NOL, accept=muncul, revoke=NOL (tiga-tiganya harus lolos)

---

## 2. Billing — nominal + negatif (tanpa uang asli)

> Harga acuan (seed kanonis `server/src/db/seeds/001_pro_pricing_2026-09-13.sql`, ADR-045):
> Pro 30 hari Rp 249.000 · 90 hari Rp 699.000 · 365 hari Rp 2.490.000 (ditulis `2490000`) via Pakasir (QRIS/VA).
> Promo LAUNCH149 = 30 hari Rp 149.000 (coret Rp 249.000), **nonaktif by default** — jangan dianggap harga reguler.
> Uji di team sandbox, JANGAN di team produksi.

### 2.1 Nominal (harus berhasil)

1. Buat team sandbox → Billing → pilih paket Pro Bulanan → Checkout → dapat URL `app.pakasir.com/pay/...?order_id=...` dengan amount **Rp 249.000** (bukan 250.000).
2. Bayar nominal terkecil yang diizinkan sandbox → webhook `completed` → `GET /billing/status/:teamId` = `pro`, `expires` +30 hari (stacking bila sudah pro).

```bash
# status billing (ganti TEAM_ID + cookie login):
curl -sS -b cookies.txt https://devhub.nrawangbatin.my.id/api/v1/billing/status/TEAM_ID
# expected (contoh, plan pro + expires maju):
# {"plan":"pro","expires":"2026-10-13T02:00:00.000Z","...": "..."}
```

- [ ] Checkout nominal → URL Pakasir valid + `order_id` tercatat `pending` + amount = harga seed (`249000`/`699000`/`2490000`)
- [ ] Setelah bayar sandbox → status `pro`, expiry +N hari, riwayat muncul di `/payments`
- [ ] Promo LAUNCH149 (Rp 149.000) tetap nonaktif kecuali sengaja diaktifkan via admin (tidak muncul sebagai pilihan reguler)

### 2.2 Negatif (harus ditolak aman)

| Kasus | Expected |
|---|---|
| Nominal mismatch (amount diubah) | `200 silent`, plan TIDAK berubah, payment tetap `pending`/`failed` |
| `order_id` tak dikenal | `200 silent`, tidak ada extend |
| Double webhook `order_id` sama | Idempoten: extend sekali saja |
| Non-admin checkout | `403` |

```bash
# contoh negatif: non-admin ditolak (ganti TEAM_ID, pakai cookie viewer):
curl -sS -o /tmp/bill_neg.json -w "%{http_code}\n" -b cookies_viewer.txt \
  -H 'Content-Type: application/json' \
  -d '{"teamId":"TEAM_ID","packageId":"PKG","priceId":"PRICE"}' \
  https://devhub.nrawangbatin.my.id/api/v1/billing/checkout
# expected: 403
cat /tmp/bill_neg.json
# expected: {"error":{"code":"FORBIDDEN",...}}
```

- [ ] Semua negatif di atas sesuai expected (tidak ada extend gratis)

---

## 3. View Source — canonical / OG / lang=id

```bash
curl -sS https://devhub.nrawangbatin.my.id/ -o /tmp/home.html
grep -oiE '<html[^>]*lang="[^"]*"' /tmp/home.html
# expected: <html lang="id"
```

```bash
grep -oiE '<link rel="canonical"[^>]*>' /tmp/home.html
# expected (satu baris, domain publik, tanpa trailing ganda):
# <link rel="canonical" href="https://devhub.nrawangbatin.my.id/">
```

```bash
grep -oiE '<meta property="og:[^>]*>' /tmp/home.html
# expected: minimal og:title + og:description + og:image + og:url (4 baris), semua URL absolut https://devhub.nrawangbatin.my.id/...
```

```bash
grep -oiE '<meta name="description"[^>]*>' /tmp/home.html
# expected: satu meta description 150-160 karakter, unik per halaman utama
```

- [ ] `<html lang="id">` (bukan `en`)
- [ ] Satu canonical absolut ke domain publik
- [ ] OG lengkap (title/description/image/url absolut)
- [ ] Tidak ada GA ID / secret di View Source (lihat §1.2)

---

## 4. robots.txt + sitemap.xml — tanpa /p/*

> Alasan: `/p/*` (public project) tidak boleh dirayapi/diindeks massal sebelum kebijakan publik final.

```bash
curl -sS https://devhub.nrawangbatin.my.id/robots.txt
# expected (contoh, sesuaikan isi final — yang penting ADA + tidak allow /p/):
# User-agent: *
# Allow: /
# Disallow: /p/
# Sitemap: https://devhub.nrawangbatin.my.id/sitemap.xml
```

```bash
curl -sS https://devhub.nrawangbatin.my.id/robots.txt | grep -c '/p/' || echo "0"
# expected: angka >= 1 JIKA memakai Disallow di atas (baris Disallow mengandung /p/).
# Jika memakai Allow-only tanpa menyebut /p/, expected: 0 + sitemap di bawah dipastikan tanpa /p/ juga.
```

```bash
curl -sS https://devhub.nrawangbatin.my.id/sitemap.xml -o /tmp/sitemap.xml
grep -oiE '<loc>[^<]*</loc>' /tmp/sitemap.xml | head -20
# expected: list URL publik (/, /pricing, /features/...) — TIDAK ADA yang mengandung /p/
```

```bash
grep -c '/p/' /tmp/sitemap.xml || echo "0-match"
# expected: 0-match (atau grep exit 1 = tidak ada /p/* di sitemap)
```

- [ ] `robots.txt` 200 + menunjuk sitemap absolut
- [ ] `sitemap.xml` 200 + valid XML + NOL entri `/p/*`
- [ ] Deep-link `/p/:id` tetap bisa dibuka manual (SPA fallback), hanya tidak ada di sitemap/robots-allow

---

## 5. GSC — canonical + coverage tanpa /p/*

Manual di Google Search Console (tanpa tempel ID di repo):

1. URL Inspection → `https://devhub.nrawangbatin.my.id/` → **User-declared canonical** = `https://devhub.nrawangbatin.my.id/` (sama dengan View Source §3).
2. Coverage → filter `Valid` → pastikan TIDAK ADA URL `/p/*` yang Valid/Indexed.
3. Sitemaps → submit `https://devhub.nrawangbatin.my.id/sitemap.xml` → status Success, discovered = jumlah di §4 (tanpa `/p/*`).

- [ ] GSC canonical = canonical View Source (cocok persis)
- [ ] Coverage: 0 URL `/p/*` terindeks
- [ ] Sitemap di GSC Success

---

## 6. PageSpeed — LCP < 2.5 · INP < 200 · CLS < 0.1

Uji di PageSpeed Insights → Mobile + Desktop untuk `/` (dan satu `/pricing` bila ada):

| Metrik | Ambang lolos |
|---|---|
| LCP | < 2.5 s |
| INP | < 200 ms |
| CLS | < 0.1 |

- [ ] Mobile: LCP<2.5, INP<200, CLS<0.1
- [ ] Desktop: LCP<2.5, INP<200, CLS<0.1
- [ ] Jika FAIL: optimasi (kompres <100KB WebP/AVIF, lazy image, kurangi JS) lalu uji ulang — JANGAN go-live dengan merah

---

## 7. /health + cookie Lax via proxy (bukan None)

```bash
curl -sS https://devhub.nrawangbatin.my.id/api/v1/health
# expected (200):
# {"status":"ok","db":"connected","uptime":12345.6}
```

```bash
curl -sS -o /tmp/health.json -w "%{http_code}\n" https://devhub.nrawangbatin.my.id/api/v1/health
# expected: 200
grep -q '"status":"ok"' /tmp/health.json && echo "HEALTH OK" || echo "HEALTH FAIL"
# expected: HEALTH OK
```

```bash
# cookie Lax first-party (login lalu cek header):
curl -sSI -H 'Content-Type: application/json' https://devhub.nrawangbatin.my.id/api/v1/health | grep -i '^set-cookie' || echo "no-set-cookie-on-health (OK, cookie hanya di /auth/login)"
# expected: no-set-cookie-on-health (OK, cookie hanya di /auth/login)
```

```bash
# setelah login, pastikan Lax bukan None:
curl -sS -D /tmp/hdrs.txt -o /dev/null -c /tmp/cj.txt -H 'Content-Type: application/json' \
  -d '{"email":"probe@example.com","password":"Probe123!"}' \
  https://devhub.nrawangbatin.my.id/api/v1/auth/login || true
grep -oiE 'set-cookie: devhub_session[^;]*;[^$]*' /tmp/hdrs.txt || echo "cek manual di DevTools"
# expected: ... HttpOnly; ... SameSite=Lax ... (TIDAK BOLEH SameSite=None)
```

- [ ] `/health` 200 + `"status":"ok"` (via `devhub.nrawangbatin.my.id`, bukan langsung `suga.run`)
- [ ] Cookie `devhub_session` = `HttpOnly; SameSite=Lax; Secure` (bukan `None`)
- [ ] UptimeRobot `devhub-prod-health` hijau (lihat [Monitoring §2.2.1](monitoring.md#221-setup-uptimerobot-free-5-menit-phase-2-aktif-2026-09-13))
- [ ] ntfy test masuk: `curl -d "test go-live $(date -u +%FT%TZ)" ntfy.sh/devhub-alerts` → push diterima

---

## 7b. Smoke storage + i18n + mobile (Tier-2, Sep-2026)

### 7b.1 Storage TUS + fallback PUT (Incognito login)

```bash
# presign TUS (ganti cookie login + PROJECT_ID/TASK_ID):
curl -sS -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"projectId":"PROJECT_ID","taskId":"TASK_ID","filename":"smoke.png","mime":"image/png","size":12345}' \
  https://devhub.nrawangbatin.my.id/api/v1/attachments/presign | head -c 300
# expected: {"tusEndpoint":"https://.../storage/v1/upload/resumable","uploadToken":"...","bucket":"devhub-attachments",...}
# upload 1 file kecil via TUS (header x-signature + x-upsert konsisten) → 200; ulangi via fallback PUT uploadUrl → 200
```

- [ ] Presign TUS OK (dapat `tusEndpoint` + `uploadToken`), upload kecil via TUS 200
- [ ] Fallback PUT via `uploadUrl` 200 (jalur darurat insiden 403 upsert)
- [ ] NOL 403 `Invalid Compact JWS` di log Suga `cuddly-hawk` selama smoke

### 7b.2 i18n P0+P1 (ID ↔ EN)

1. Login → ganti bahasa ID → EN → ID (header/settings), reload tiap ganti.
2. Buka: template picker, label picker, billing, auth (login/register), whiteboard toolbar.

- [ ] Tidak ada string kosong / key mentah (`*.title`, `undefined`) di semua layar di atas, kedua bahasa
- [ ] `?lang=` (bila dipakai) konsisten setelah reload + navigasi SPA

### 7b.3 Mobile template/label + kebab (390px, touch)

1. DevTools device 390px (atau HP asli) → login → buka board/issue.
2. Buka template picker + label picker; tap menu kebab (⋮) tiap kartu.

- [ ] Template/label picker terbuka penuh, bisa pilih tanpa iOS zoom / terpotong
- [ ] Menu kebab terlihat & ter-tap (touch target ≥ 36px), aksi jalan (edit/pin/hapus sesuai role)

---

## 8. Drill log — restore terbukti

- [ ] Tabel drill di [Backup & Recovery §5](backup-recovery.md#5-recovery-drill-quarterly--mandatory) terisi ≥ 1 baris PASS nyata (bukan hanya contoh) dengan: Date + Restored from + Result + Notes (users/projects cocok, login OK, open project OK, export round-trip `restored:true`)
- [ ] File dump offsite ada dan lolos `pg_restore --list`:

```bash
ls -lh /mnt/offsite/devhub/devhub_*.dump | tail -5
# expected: minimal 1 file hari ini, size > 0

pg_restore --list /mnt/offsite/devhub/devhub_$(date -u +%F).dump >/dev/null && echo "DUMP VALID" || echo "DUMP INVALID"
# expected: DUMP VALID
```

---

## 9. Hasil & tanda tangan

| Tanggal UTC | Penguji buta | Hasil (GO / NO-GO) | Catatan FAIL (section + expected vs aktual) |
|---|---|---|---|
| YYYY-MM-DD | ... | ... | ... |

- GO bila §1→§8 semua `[x]`.
- NO-GO bila satu saja FAIL — buat issue + postmortem bila SEV-1/2 (lihat [Incident Response](incident-response.md)).

---

*End of Go-Live Checklist Tier-2.*
