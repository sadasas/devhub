-- 046_github: GitHub App integration foundation (F1)
-- - github_installations: satu baris per installasi App GitHub (org/akun),
--   token instalasi + webhook secret tersimpan terenkripsi (sealToken AES-256-GCM,
--   pola gcal_connections di 038_gcal). Token plaintext TIDAK PERNAH di-log.
-- - github_project_repos: mapping per-project DevHub <-> 1 repo GitHub
--   (keputusan: 1 repo/proyek di Free; monorepo boleh dipetakan ke banyak proyek,
--   jadi tanpa UNIQUE di owner/repo). automation = aturan PR->status
--   (default suggest/suggest — tanpa auto-move diam-diam).
-- - github_webhook_events: idempotency log per X-GitHub-Delivery (anti-replay/duplikat).
-- - github_outbox: antrean retry operasi webhook yang gagal (backoff di app layer,
--   pola gcal_outbox di 038_gcal).
--
-- updated_at dirawat app + trigger (pola 014_hardening set_updated_at).

CREATE TABLE IF NOT EXISTS github_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id bigint UNIQUE NOT NULL,
  account_login text,
  account_type text,
  token_blob text,
  token_expires_at timestamptz,
  webhook_secret_blob text,
  status text NOT NULL DEFAULT 'connected',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_github_installations_status ON github_installations (status);

CREATE TABLE IF NOT EXISTS github_project_repos (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  installation_id bigint NOT NULL REFERENCES github_installations(installation_id) ON DELETE CASCADE,
  owner text NOT NULL,
  repo text NOT NULL,
  automation jsonb NOT NULL DEFAULT '{"onPrOpened":"suggest","onPrMerged":"suggest"}'::jsonb,
  connected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT github_project_repos_owner_check CHECK (owner <> '' AND length(owner) <= 100),
  CONSTRAINT github_project_repos_repo_check CHECK (repo <> '' AND length(repo) <= 100)
);
CREATE INDEX IF NOT EXISTS idx_github_project_repos_installation ON github_project_repos (installation_id);
CREATE INDEX IF NOT EXISTS idx_github_project_repos_owner_repo ON github_project_repos (owner, repo);

CREATE TABLE IF NOT EXISTS github_webhook_events (
  delivery_id text PRIMARY KEY,
  event text NOT NULL,
  action text,
  repo text,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_github_webhook_events_repo ON github_webhook_events (repo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_github_webhook_events_project ON github_webhook_events (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS github_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id uuid,
  op text NOT NULL CHECK (op IN ('link', 'status', 'comment', 'import')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_retry_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_github_outbox_retry ON github_outbox (project_id, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_github_outbox_task ON github_outbox (project_id, task_id);

-- Trigger updated_at (pola 014_hardening set_updated_at, dipakai 038_gcal)
DROP TRIGGER IF EXISTS trg_github_installations_updated_at ON github_installations;
CREATE TRIGGER trg_github_installations_updated_at BEFORE UPDATE ON github_installations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_github_project_repos_updated_at ON github_project_repos;
CREATE TRIGGER trg_github_project_repos_updated_at BEFORE UPDATE ON github_project_repos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
