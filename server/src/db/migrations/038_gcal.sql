-- 038_gcal: Google Calendar integration foundation (T1+T2)
-- - gcal_connections: OAuth tokens per user (refresh encrypted via key-crypto AES-256-GCM)
-- - gcal_project_settings: calendar mapping per project + ICS fallback token
-- - gcal_event_map: task <-> event idempotency map
-- - gcal_outbox: reliable sync queue with retry backoff
--
-- Security: tokens never logged; refresh_token_enc NOT NULL; access_token_enc nullable
-- (short-lived). updated_at maintained by app + trigger (pola 014_hardening).

CREATE TABLE IF NOT EXISTS gcal_connections (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_enc text NOT NULL,
  access_token_enc text,
  expiry timestamptz,
  scope text,
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gcal_project_settings (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  calendar_id text,
  sync_enabled boolean NOT NULL DEFAULT false,
  ics_token text UNIQUE,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcal_settings_owner ON gcal_project_settings (owner_user_id);

CREATE TABLE IF NOT EXISTS gcal_event_map (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid NOT NULL,
  event_id text NOT NULL,
  calendar_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_gcal_event_map_project ON gcal_event_map (project_id);

CREATE TABLE IF NOT EXISTS gcal_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid,
  op text NOT NULL CHECK (op IN ('upsert', 'delete')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_retry_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcal_outbox_retry ON gcal_outbox (project_id, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_gcal_outbox_task ON gcal_outbox (project_id, task_id);

-- Trigger updated_at (pola 014_hardening set_updated_at)
DROP TRIGGER IF EXISTS trg_gcal_connections_updated_at ON gcal_connections;
CREATE TRIGGER trg_gcal_connections_updated_at BEFORE UPDATE ON gcal_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_gcal_project_settings_updated_at ON gcal_project_settings;
CREATE TRIGGER trg_gcal_project_settings_updated_at BEFORE UPDATE ON gcal_project_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_gcal_event_map_updated_at ON gcal_event_map;
CREATE TRIGGER trg_gcal_event_map_updated_at BEFORE UPDATE ON gcal_event_map
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
