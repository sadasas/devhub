-- 015_fail_closed_public_tabs: default public_tabs fail-closed (audit 2026-08b, PUB-2)
-- Proyek BARU tidak lagi otomatis membuka semua tab saat di-publish tanpa
-- publicTabs eksplisit. Proyek lama mempertahankan nilainya masing-masing
-- (dikelola via ShareModal).
ALTER TABLE projects ALTER COLUMN public_tabs SET DEFAULT '[]'::jsonb;