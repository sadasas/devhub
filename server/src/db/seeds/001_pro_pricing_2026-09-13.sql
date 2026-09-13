-- Seed pricing Pro ADR-045 — 2026-09-13-v2 (Tier 2 MUST).
--
-- Tujuan: harga kanonis produksi untuk paket Pro (unlimited, is_featured).
--   billing_packages: Pro (max_members NULL, max_projects NULL, is_featured = true)
--   billing_package_prices:
--     (30, 249000) reguler bulanan
--     (90, 699000) reguler triwulan
--     (365, 2490000) reguler tahunan
--     (30, 149000, original 249000) promo LAUNCH149 (nonaktif by default)
--
-- Kompatibilitas: membutuhkan migration 021_packages.sql (tabel + seed Free/Pro),
--   022b_price_original.sql (kolom original_price_idr), 034_package_featured.sql
--   (kolom is_featured + unique partial). Jangan jalankan sebelum migrate().
-- Harga TIDAK di-hardcode di kode — checkout/webhook membaca price_idr dari DB
--   (billingService.startCheckout → findActivePrice; URL Pakasir memakai amount DB).
-- Grandfathered: paket nonaktif tetap dihormati sampai plan_expires_at
--   (planRepository.getTeamUsage JOIN cur tanpa filter is_active, hanya expiry).
--
-- Cara pakai (prod, manual oleh operator):
--   psql "$DATABASE_URL" -f server/src/db/seeds/001_pro_pricing_2026-09-13.sql
-- Verifikasi:
--   SELECT name, is_active, is_featured, max_members, max_projects FROM billing_packages WHERE name='Pro';
--   SELECT duration_days, price_idr, original_price_idr, is_active, sort_order
--     FROM billing_package_prices WHERE package_id=(SELECT id FROM billing_packages WHERE name='Pro' AND NOT is_free)
--     ORDER BY sort_order, duration_days, price_idr;
--
-- Promo LAUNCH149: baris (30,149000) disisipkan NONAKTIF agar UI Pricing (yang
--   memilih harga per duration_days via priceId) tidak ambigu — dua baris aktif
--   dengan duration_days sama akan membuat BillingToggle/PricingCard memilih
--   salah satu secara arbitrer. Untuk mengaktifkan promo, nonaktifkan harga
--   reguler 30 hari via admin API lalu aktifkan baris promo:
--     PATCH /api/v1/admin/packages/:id { prices: [...] }
--   atau UPDATE manual:
--     UPDATE billing_package_prices SET is_active=false
--      WHERE package_id=(SELECT id FROM billing_packages WHERE name='Pro' AND NOT is_free)
--        AND duration_days=30 AND price_idr=249000;
--     UPDATE billing_package_prices SET is_active=true
--      WHERE package_id=(SELECT id FROM billing_packages WHERE name='Pro' AND NOT is_free)
--        AND duration_days=30 AND price_idr=149000;

BEGIN;

-- 1. Pastikan paket Pro ada (idempoten, cermin 021). Unlimited = NULL/NULL.
INSERT INTO billing_packages (name, description, is_free, max_members, max_projects, sort_order, is_active)
SELECT 'Pro', 'Unlimited members & projects', false, NULL, NULL, 1, true
WHERE NOT EXISTS (SELECT 1 FROM billing_packages WHERE NOT is_free AND name = 'Pro');

-- 2. Tandai Pro sebagai featured (eksklusif, maks satu — pola 034).
--    Clear featured lain dulu agar tidak melanggar uq_billing_packages_one_featured.
UPDATE billing_packages SET is_featured = false WHERE is_featured AND NOT (name = 'Pro' AND NOT is_free);
UPDATE billing_packages SET is_featured = true, updated_at = now()
WHERE name = 'Pro' AND NOT is_free AND NOT is_featured;

-- 3. Harga reguler (idempoten per duration+price). Aktifkan bila sudah ada tapi nonaktif
--    (mis. DB lama dari 021 dengan (30,250000)/(365,2500000) tetap dipertahankan
--    sebagai riwayat nonaktif — grandfathered untuk pembayaran yang sudah completed).
INSERT INTO billing_package_prices (package_id, duration_days, price_idr, original_price_idr, sort_order, is_active)
SELECT p.id, x.duration_days, x.price_idr, NULL::int, x.sort_order, true
FROM billing_packages p
CROSS JOIN (VALUES (30, 249000, 0), (90, 699000, 1), (365, 2490000, 2)) AS x(duration_days, price_idr, sort_order)
WHERE p.name = 'Pro' AND p.is_free = false
  AND NOT EXISTS (
    SELECT 1 FROM billing_package_prices pp
    WHERE pp.package_id = p.id AND pp.duration_days = x.duration_days AND pp.price_idr = x.price_idr
  );

-- 3b. Normalisasi: pastikan tiga harga reguler di atas aktif (re-aktivasi aman).
UPDATE billing_package_prices pp SET is_active = true, sort_order = x.sort_order, original_price_idr = NULL
FROM billing_packages p,
     (VALUES (30, 249000, 0), (90, 699000, 1), (365, 2490000, 2)) AS x(duration_days, price_idr, sort_order)
WHERE pp.package_id = p.id AND p.name = 'Pro' AND p.is_free = false
  AND pp.duration_days = x.duration_days AND pp.price_idr = x.price_idr;

-- 3c. Pensiunkan harga legacy 021 (30,250000)/(365,2500000) — nonaktif sebagai
--    riwayat (pembayaran completed menyimpan snapshot amount, jadi aman).
--    Pembelian baru hanya memakai kanonis + promo di bawah.
UPDATE billing_package_prices pp SET is_active = false
FROM billing_packages p
WHERE pp.package_id = p.id AND p.name = 'Pro' AND p.is_free = false
  AND pp.is_active
  AND NOT (
    (pp.duration_days = 30 AND pp.price_idr IN (249000, 149000))
    OR (pp.duration_days = 90 AND pp.price_idr = 699000)
    OR (pp.duration_days = 365 AND pp.price_idr = 2490000)
  );

-- 4. Promo LAUNCH149: 30 hari Rp149.000 (coret Rp249.000), NONAKTIF by default
--    (alasan + cara aktivasi: lihat header file).
INSERT INTO billing_package_prices (package_id, duration_days, price_idr, original_price_idr, sort_order, is_active)
SELECT p.id, 30, 149000, 249000, 3, false
FROM billing_packages p
WHERE p.name = 'Pro' AND p.is_free = false
  AND NOT EXISTS (
    SELECT 1 FROM billing_package_prices pp
    WHERE pp.package_id = p.id AND pp.duration_days = 30 AND pp.price_idr = 149000
  );

COMMIT;
