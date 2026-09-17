-- 040_gcal_drop_ics: hapus ICS feed fallback — integrasi GCal hanya via Calendar API.
-- Mencabut kolom ics_token (+ unique constraint) dari gcal_project_settings.
-- Idempoten + zero-downtime (IF EXISTS, tanpa lock tulis lama).
-- Rollback: ADD COLUMN ics_token text UNIQUE (data token lama tidak kembali).

ALTER TABLE gcal_project_settings DROP CONSTRAINT IF EXISTS gcal_project_settings_ics_token_key;
DROP INDEX IF EXISTS idx_gcal_settings_token;
ALTER TABLE gcal_project_settings DROP COLUMN IF EXISTS ics_token;
