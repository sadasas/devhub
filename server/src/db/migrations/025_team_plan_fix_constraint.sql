-- 025_team_plan_fix_constraint: align DB CHECK with code enum 'free'/'pro' (ADR-043).
-- Previous DB had 'paid' (from 024_team_plan_paid applied outside repo) causing 23514 on grant Business.
-- This migration makes constraint definitive and migrates existing 'paid' rows to 'pro'.
ALTER TABLE teams DROP CONSTRAINT IF EXISTS chk_teams_plan;
UPDATE teams SET plan = 'pro' WHERE plan = 'paid';
ALTER TABLE teams ADD CONSTRAINT chk_teams_plan CHECK (plan IN ('free', 'pro'));
