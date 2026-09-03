-- 022_pending_package: same-type stack lazy activation for downgrade reschedule (decision cea0cdbd, B1)
-- Upgrade instan, downgrade dijadwalkan ke pending dan diaktivasi lazy saat expiry habis (tanpa cron).
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS plan_pending_package_id uuid REFERENCES billing_packages(id) ON DELETE SET NULL;
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS plan_pending_duration int CHECK (plan_pending_duration > 0);
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS plan_pending_created_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_teams_pending ON teams(plan_pending_package_id) WHERE plan_pending_package_id IS NOT NULL;
