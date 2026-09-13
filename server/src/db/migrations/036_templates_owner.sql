-- 036_templates_owner: project templates become private owner-only global.
-- Locked decision: a template sticks to its owner (userId), is visible only
-- to the owner, and can be instantiated into any team the owner belongs to.
-- No sharing, no team visibility.
--
-- Ownership mapping rules (applied below in order):
-- 1. Normal case: owner_id = created_by (the creator keeps their templates).
-- 2. Orphan case (created_by has no matching users row, e.g. deleted user):
--    owner = oldest member of the template's original team
--    (team_members ordered by joined_at ASC, user_id ASC as tie-break).
-- 3. Fallback: owner = teams.created_by of the original team
--    (only when that user row still exists).
-- 4. Last resort: rows still without an owner are removed (no accountable
--    owner). In practice this set is empty because deleting a team already
--    cascades its templates away (ON DELETE CASCADE on the old team_id).
--
-- After backfill: owner_id is SET NOT NULL, the old team_id column is
-- dropped, and the index moves from team_id to owner_id.

ALTER TABLE project_templates
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Rule 1: creator keeps their templates.
UPDATE project_templates
SET owner_id = created_by
WHERE owner_id IS NULL
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = created_by);

-- Rule 2: orphan -> oldest member of the original team.
UPDATE project_templates
SET owner_id = (
  SELECT m.user_id
  FROM team_members m
  WHERE m.team_id = project_templates.team_id
  ORDER BY m.joined_at ASC, m.user_id ASC
  LIMIT 1
)
WHERE owner_id IS NULL;

-- Rule 3: fallback -> creator of the original team.
UPDATE project_templates
SET owner_id = (
  SELECT t.created_by
  FROM teams t
  WHERE t.id = project_templates.team_id
)
WHERE owner_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM teams t
    JOIN users u ON u.id = t.created_by
    WHERE t.id = project_templates.team_id
  );

-- Rule 4: no accountable owner remains -> drop the row rather than
-- assigning it to a stranger.
DELETE FROM project_templates WHERE owner_id IS NULL;

ALTER TABLE project_templates ALTER COLUMN owner_id SET NOT NULL;

DROP INDEX IF EXISTS idx_project_templates_team_id;
CREATE INDEX IF NOT EXISTS idx_project_templates_owner_id ON project_templates (owner_id);

ALTER TABLE project_templates DROP COLUMN IF EXISTS team_id;
