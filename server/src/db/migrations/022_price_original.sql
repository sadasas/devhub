-- 022_price_original: harga asli (sebelum diskon) per baris harga paket.
-- NULL = tanpa diskon; diisi harus > price_idr agar badge "Hemat X%" muncul.

ALTER TABLE billing_package_prices
  ADD COLUMN IF NOT EXISTS original_price_idr int NULL
  CHECK (original_price_idr IS NULL OR original_price_idr >= 0);
