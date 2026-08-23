-- 020_billing: langganan Pakasir per workspace (ADR-044, ADR-043 Fase 2)
-- teams.plan_expires_at: NULL = grant manual operator (tanpa kedaluwarsa);
-- setelah pembayaran = tanggal kedaluwarsa eksplisit.
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS team_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  order_id text NOT NULL UNIQUE,
  period text NOT NULL CHECK (period IN ('monthly', 'yearly')),
  amount int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_team_payments_team ON team_payments (team_id);
