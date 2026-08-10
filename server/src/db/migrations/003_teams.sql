-- 003_teams: teams, team_members, invitations; projects move from owner_id to team_id
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'editor',
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email_status ON invitations (email, status);
CREATE INDEX IF NOT EXISTS idx_invitations_team_id ON invitations (team_id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects (team_id);

DO $$
DECLARE
  u RECORD;
  tid uuid;
BEGIN
  FOR u IN SELECT id FROM users LOOP
    SELECT id INTO tid FROM teams WHERE created_by = u.id AND name = 'Personal' LIMIT 1;
    IF tid IS NULL THEN
      INSERT INTO teams (name, created_by) VALUES ('Personal', u.id) RETURNING id INTO tid;
    END IF;
    INSERT INTO team_members (team_id, user_id, role)
      VALUES (tid, u.id, 'owner')
      ON CONFLICT (team_id, user_id) DO NOTHING;
    UPDATE projects SET team_id = tid WHERE owner_id = u.id AND team_id IS NULL;
  END LOOP;
END $$;

ALTER TABLE projects ALTER COLUMN team_id SET NOT NULL;
ALTER TABLE projects DROP COLUMN IF EXISTS owner_id;
