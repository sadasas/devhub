-- 031_billing_webhook_logs: persist Pakasir webhook hits for audit/forensics (ADR-044 addendum)
-- Setiap POST /billing/webhook wajib insert 1 baris — termasuk unknown order / mismatch / verify gagal / duplikat.
-- Raw body + filtered headers + IP + verify result disimpan ter-query, bukan hanya stdout logger.
CREATE TABLE IF NOT EXISTS billing_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  amount int,
  incoming_status text,
  raw_body jsonb NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  verify_ok boolean,
  verify_payload jsonb,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES team_payments(id) ON DELETE SET NULL,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bwl_order ON billing_webhook_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_bwl_team_created ON billing_webhook_logs(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bwl_created ON billing_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bwl_verify ON billing_webhook_logs(verify_ok) WHERE verify_ok IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bwl_payment ON billing_webhook_logs(payment_id) WHERE payment_id IS NOT NULL;
