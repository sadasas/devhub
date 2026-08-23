-- 021_packages: paket langganan dinamis dari DB, dikelola admin (ADR-045).
-- Limit efektif workspace = paket terpasang selama aktif & belum kedaluwarsa,
-- selain itu fallback ke paket Free (is_free=true, satu-satunya).

CREATE TABLE IF NOT EXISTS billing_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_free boolean NOT NULL DEFAULT false,
  max_members int NULL,
  max_projects int NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_packages_one_free
  ON billing_packages (is_free) WHERE is_free;

CREATE TABLE IF NOT EXISTS billing_package_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES billing_packages(id) ON DELETE CASCADE,
  duration_days int NOT NULL CHECK (duration_days > 0),
  price_idr int NOT NULL CHECK (price_idr >= 0),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_billing_package_prices_pkg
  ON billing_package_prices (package_id);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS plan_package_id uuid
  REFERENCES billing_packages(id) ON DELETE SET NULL;

ALTER TABLE team_payments
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES billing_packages(id),
  ADD COLUMN IF NOT EXISTS package_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS duration_days int;
ALTER TABLE team_payments DROP CONSTRAINT IF EXISTS team_payments_period_check;
ALTER TABLE team_payments ALTER COLUMN period DROP DEFAULT;
ALTER TABLE team_payments ALTER COLUMN period DROP NOT NULL;

-- Seed default (idempoten): Free 2 member/3 proyek · Pro unlimited
INSERT INTO billing_packages (name, description, is_free, max_members, max_projects, sort_order)
SELECT 'Free', 'For getting started', true, 2, 3, 0
WHERE NOT EXISTS (SELECT 1 FROM billing_packages WHERE is_free);

INSERT INTO billing_packages (name, description, is_free, max_members, max_projects, sort_order)
SELECT 'Pro', 'Unlimited members & projects', false, NULL, NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM billing_packages WHERE NOT is_free AND name = 'Pro');

INSERT INTO billing_package_prices (package_id, duration_days, price_idr, sort_order)
SELECT p.id, x.duration_days, x.price_idr, x.sort_order
FROM billing_packages p
CROSS JOIN (VALUES (30, 250000::int, 0), (365, 2500000::int, 1))
  AS x(duration_days, price_idr, sort_order)
WHERE p.name = 'Pro' AND p.is_free = false
  AND NOT EXISTS (
    SELECT 1 FROM billing_package_prices pp
    WHERE pp.package_id = p.id AND pp.duration_days = x.duration_days
  );
