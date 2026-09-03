-- 019_team_plan: langganan per tim untuk ADR-043 (freemium 2-tier)
-- 'free' default; 'pro' diaktifkan operator via PATCH /api/v1/admin/teams/:id/plan (Fase 1 manual).
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_teams_plan'
  ) THEN
    ALTER TABLE teams
      ADD CONSTRAINT chk_teams_plan CHECK (plan IN ('free', 'pro'));
  END IF;
END $$;
