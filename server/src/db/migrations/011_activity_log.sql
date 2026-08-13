-- 011_activity_log: server-authoritative change log per entity (outside projects.data)
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_project_created ON activity_log (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity_created ON activity_log (entity, entity_id, created_at DESC);
