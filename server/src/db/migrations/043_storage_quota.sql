-- 043_storage_quota: kuota penyimpanan lampiran per paket + counter pemakaian per tim.
-- max_storage_bytes NULL = unlimited; 0 = upload mati (hanya tautan).
-- storage_used_bytes = jumlah byte lampiran provider DevHub milik tim (dikelola transaksional).

ALTER TABLE billing_packages
  ADD COLUMN IF NOT EXISTS max_storage_bytes BIGINT NULL;

ALTER TABLE billing_packages
  DROP CONSTRAINT IF EXISTS billing_packages_max_storage_bytes_check;

ALTER TABLE billing_packages
  ADD CONSTRAINT billing_packages_max_storage_bytes_check
  CHECK (max_storage_bytes IS NULL OR max_storage_bytes >= 0);

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;

-- Seed default (idempoten): Free = tanpa upload, paket bayar = 100 MB.
UPDATE billing_packages SET max_storage_bytes = 0
WHERE is_free AND max_storage_bytes IS NULL;

UPDATE billing_packages SET max_storage_bytes = 104857600
WHERE NOT is_free AND max_storage_bytes IS NULL;
