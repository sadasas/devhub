-- 039_gcal_reconcile: rekonsiliasi fondasi T1+T2 + indeks worker T3 (tanpa ubah tabel destruktif).
-- Zero-downtime, rollback = no-op. Indeks due-scan global untuk processOutbox()
-- agar tidak full-scan (rollback indeks: DROP INDEX IF EXISTS idx_gcal_outbox_due).
-- 038_gcal.sql (T1+T2) apply duluan di test DB; 038_gcal_sync + 038_gcal_project_settings
-- no-op untuk tabel (IF NOT EXISTS) tapi index-nya tetap terbuat. Skema aktual = milik
-- 038_gcal.sql (op CHECK hanya upsert/delete) sehingga insert/patch sync-service akan gagal.
-- Migrasi ini menyatukan superset tanpa ALTER destruktif (zero-downtime, rollback = no-op):
-- - created_at yang hilang (sync-service SELECT created_at di outbox/event_map)
-- - op CHECK dilonggarkan ke 4 nilai (upsert/insert/patch/delete) agar T2 mapping manual
--   (upsert) dan T3 sync-service (insert/patch/delete) sama-sama valid
-- - calendar_id default 'primary' + backfill NULL agar repository T3 (NOT NULL di desain
--   awal) tidak pecah bila settings dibuat via jalur ICS (hanya project_id+ics_token)

ALTER TABLE gcal_connections ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE gcal_connections ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE gcal_connections ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE gcal_project_settings ADD COLUMN IF NOT EXISTS calendar_id text;
ALTER TABLE gcal_project_settings ADD COLUMN IF NOT EXISTS sync_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE gcal_project_settings ADD COLUMN IF NOT EXISTS ics_token text;
ALTER TABLE gcal_project_settings ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE gcal_project_settings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE gcal_event_map ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Backfill calendar_id NULL -> 'primary' sebelum set default (idempotent)
UPDATE gcal_project_settings SET calendar_id = 'primary' WHERE calendar_id IS NULL;
ALTER TABLE gcal_project_settings ALTER COLUMN calendar_id SET DEFAULT 'primary';
ALTER TABLE gcal_event_map ALTER COLUMN calendar_id SET DEFAULT 'primary';

-- Longgarkan op CHECK (nama constraint dari 038_gcal.sql): upsert/delete + insert/patch
ALTER TABLE gcal_outbox DROP CONSTRAINT IF EXISTS gcal_outbox_op_check;
ALTER TABLE gcal_outbox ADD CONSTRAINT gcal_outbox_op_check CHECK (op IN ('upsert', 'insert', 'patch', 'delete'));

-- Unique ics_token bila belum ada (038_gcal.sql sudah UNIQUE; guard untuk urutan apply lain)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gcal_project_settings_ics_token_key'
  ) THEN
    ALTER TABLE gcal_project_settings ADD CONSTRAINT gcal_project_settings_ics_token_key UNIQUE (ics_token);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gcal_outbox_due
  ON gcal_outbox (next_retry_at) WHERE attempts < 5;
