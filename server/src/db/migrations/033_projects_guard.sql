-- 033_projects_guard: enforce 10MB data size + 512KB PRD (C5)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_projects_data_size') THEN
    ALTER TABLE projects ADD CONSTRAINT chk_projects_data_size CHECK (pg_column_size(data) <= 10*1024*1024);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_projects_prd_size') THEN
    ALTER TABLE projects ADD CONSTRAINT chk_projects_prd_size CHECK (prd IS NULL OR pg_column_size(prd::text::jsonb) <= 512*1024);
  END IF;
END $$;

-- Additional indexes for hardening (from DB audit M1)
CREATE INDEX IF NOT EXISTS idx_teams_plan_package ON teams(plan_package_id) WHERE plan_package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_payments_package ON team_payments(package_id) WHERE package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_project_entity_created ON activity_log(project_id, entity, entity_id, created_at DESC);
