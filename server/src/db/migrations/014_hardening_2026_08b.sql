-- 014_hardening_2026_08b: remediasi audit 2026-08b
-- DB-9/API-6: invitations — unique pending (team,email), CHECK status, index komposit, cleanup expired
-- DB-17: invitations.token tidak pernah dipakai — dihapus
-- DB-13: mcp_keys index redundan dihapus (uq_mcp_keys_key_hash sudah melayani lookup)
-- DB-14: team_messages index pagination dengan tie-breaker id
-- DB-12: trigger updated_at untuk tabel yang punya kolom updated_at

CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_team_email_pending
  ON invitations (team_id, email) WHERE status = 'pending';

ALTER TABLE invitations ADD CONSTRAINT chk_invitations_status
  CHECK (status IN ('pending', 'accepted', 'declined'));

CREATE INDEX IF NOT EXISTS idx_invitations_team_status_expires
  ON invitations (team_id, status, expires_at DESC);

-- one-time cleanup undangan expired (baris pending yang kedaluwarsa)
DELETE FROM invitations WHERE status = 'pending' AND expires_at < now();

ALTER TABLE invitations DROP COLUMN IF EXISTS token;

DROP INDEX IF EXISTS idx_mcp_keys_key_hash;

CREATE INDEX IF NOT EXISTS idx_team_messages_team_created_id
  ON team_messages (team_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_project_templates_updated_at ON project_templates;
CREATE TRIGGER trg_project_templates_updated_at BEFORE UPDATE ON project_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
