import { afterAll, beforeAll } from 'vitest';
import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';

export async function resetDb(): Promise<void> {
  await pool.query(
    'TRUNCATE billing_package_prices, billing_packages, team_payments, mcp_keys, projects, users RESTART IDENTITY CASCADE',
  );
  // Seed paket default — cermin migration 021, agar tiap file test mulai konsisten.
  await pool.query(
    `INSERT INTO billing_packages (name, description, is_free, max_members, max_projects, sort_order)
     SELECT 'Free', 'For getting started', true, 2, 3, 0
     WHERE NOT EXISTS (SELECT 1 FROM billing_packages WHERE is_free)`,
  );
  await pool.query(
    `INSERT INTO billing_packages (name, description, is_free, max_members, max_projects, sort_order)
     SELECT 'Pro', 'Unlimited members & projects', false, NULL, NULL, 1
     WHERE NOT EXISTS (SELECT 1 FROM billing_packages WHERE NOT is_free AND name = 'Pro')`,
  );
  await pool.query(
    `INSERT INTO billing_package_prices (package_id, duration_days, price_idr, sort_order)
     SELECT p.id, x.duration_days, x.price_idr, x.sort_order
     FROM billing_packages p
     CROSS JOIN (VALUES (30, 250000::int, 0), (365, 2500000::int, 1))
       AS x(duration_days, price_idr, sort_order)
     WHERE p.name = 'Pro' AND p.is_free = false
       AND NOT EXISTS (
         SELECT 1 FROM billing_package_prices pp
         WHERE pp.package_id = p.id AND pp.duration_days = x.duration_days
       )`,
  );
}

beforeAll(async () => {
  await migrate(pool);
});

afterAll(async () => {
  await pool.end();
});
