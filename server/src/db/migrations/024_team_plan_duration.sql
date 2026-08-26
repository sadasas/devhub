-- 024_team_plan_duration: snapshot histori durasi grant manual (ADR-047, plan_duration_days).
-- Durasi disimpan apa adanya saat grant, tidak di-update saat harga katalog diubah — histori.
-- expires_at tetap sumber kebenaran untuk quota; durasi hanya untuk pre-select modal.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS plan_duration_days int CHECK (plan_duration_days > 0);
COMMENT ON COLUMN teams.plan_duration_days IS 'Snapshot durasi (hari) saat grant terakhir — histori, NULL untuk free/lama';
