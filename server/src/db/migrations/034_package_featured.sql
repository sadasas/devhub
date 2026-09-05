-- 034_package_featured: flag rekomendasi eksplisit untuk halaman pricing.
-- Sebelumnya badge "Direkomendasikan" hardcoded ke paket paid pertama (index 0 di FE);
-- kini dikendalikan admin via is_featured (maks satu, pola uq one_free di 021).

ALTER TABLE billing_packages ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'uq_billing_packages_one_featured') THEN
    CREATE UNIQUE INDEX uq_billing_packages_one_featured
      ON billing_packages (is_featured) WHERE is_featured;
  END IF;
END $$;

-- Backfill idempoten: paket paid aktif pertama (sort_order, created_at) jadi featured,
-- menyamai perilaku lama bila belum ada yang ditandai.
UPDATE billing_packages p
SET is_featured = true
WHERE p.id = (
  SELECT id FROM billing_packages
  WHERE is_active AND NOT is_free
  ORDER BY sort_order, created_at
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM billing_packages WHERE is_featured);
