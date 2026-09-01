import { describe, expect, it, beforeEach } from 'vitest';
import { pool } from '../src/db/pool.js';
import { getTeamUsage } from '../src/modules/plans/infrastructure/planRepository.js';
import { register, getFirstTeamId } from './helpers.js';
import { resetDb } from './setup.js';

async function getTeamRow(teamId: string) {
  const res = await pool.query<{
    plan: string;
    plan_package_id: string | null;
    plan_expires_at: Date | null;
    plan_pending_package_id: string | null;
    plan_pending_duration: number | null;
    plan_pending_created_at: Date | null;
    plan_duration_days: number | null;
  }>(
    'SELECT plan, plan_package_id, plan_expires_at, plan_pending_package_id, plan_pending_duration, plan_pending_created_at, plan_duration_days FROM teams WHERE id = $1',
    [teamId],
  );
  return res.rows[0]!;
}

async function createLimitedPackage(name = 'Basic'): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `INSERT INTO billing_packages (name, description, is_free, max_members, max_projects, sort_order, is_active)
     VALUES ($1, 'limited for pending test', false, 5, 5, 10, true)
     RETURNING id`,
    [name],
  );
  const pkgId = res.rows[0]!.id;
  await pool.query(
    `INSERT INTO billing_package_prices (package_id, duration_days, price_idr, sort_order, is_active)
     VALUES ($1, 30, 100000, 0, true)`,
    [pkgId],
  );
  return pkgId;
}

describe('B1 pending package lazy activation (022)', () => {
  let owner: string;
  let teamId: string;
  let proId: string;
  let basicId: string;

  beforeEach(async () => {
    await resetDb();
    owner = await register('pending-owner@test.dev');
    teamId = await getFirstTeamId(owner);
    const proRow = await pool.query<{ id: string }>(
      "SELECT id FROM billing_packages WHERE name = 'Pro' AND is_active LIMIT 1",
    );
    proId = proRow.rows[0]!.id;
    basicId = await createLimitedPackage();
  });

  it('activates pending when expiry is in the past (lazy, no cron)', async () => {
    // team currently Pro with expiry yesterday, pending downgrade to Basic 30 days
    await pool.query(
      `UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now() - interval '1 day',
              plan_pending_package_id=$3, plan_pending_duration=30, plan_pending_created_at=now() - interval '2 days'
       WHERE id=$1`,
      [teamId, proId, basicId],
    );

    const before = await getTeamRow(teamId);
    expect(before.plan_pending_package_id).toBe(basicId);
    expect(before.plan_package_id).toBe(proId);

    const usage = await getTeamUsage(teamId);
    expect(usage).not.toBeNull();
    // after lazy, cur should be Basic -> limits 5/5, not Pro unlimited
    expect(usage!.packageName).toBe('Basic');
    expect(usage!.memberLimit).toBe(5);
    expect(usage!.projectLimit).toBe(5);
    // pending cleared
    expect(usage!.pendingPackageId).toBeNull();
    expect(usage!.pendingDuration).toBeNull();

    const after = await getTeamRow(teamId);
    expect(after.plan_package_id).toBe(basicId);
    expect(after.plan_pending_package_id).toBeNull();
    expect(after.plan_pending_duration).toBeNull();
    expect(after.plan_pending_created_at).toBeNull();
    expect(after.plan_duration_days).toBe(30);
    // expiry stacked from now, not from old expiry
    const now = Date.now();
    expect(after.plan_expires_at!.getTime()).toBeGreaterThan(now + 29 * 86_400_000 - 60_000);
    expect(after.plan_expires_at!.getTime()).toBeLessThan(now + 31 * 86_400_000 + 60_000);
  });

  it('does not activate pending while still active (expiry in future)', async () => {
    await pool.query(
      `UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now() + interval '10 days',
              plan_pending_package_id=$3, plan_pending_duration=30, plan_pending_created_at=now()
       WHERE id=$1`,
      [teamId, proId, basicId],
    );

    const usage = await getTeamUsage(teamId);
    expect(usage!.packageName).toBe('Pro');
    expect(usage!.memberLimit).toBeNull(); // Pro unlimited
    expect(usage!.pendingPackageId).toBe(basicId);
    expect(usage!.pendingPackageName).toBe('Basic');
    expect(usage!.pendingDuration).toBe(30);

    const row = await getTeamRow(teamId);
    expect(row.plan_package_id).toBe(proId);
    expect(row.plan_pending_package_id).toBe(basicId);
  });

  it('does not activate pending for permanent grant (expiry IS NULL)', async () => {
    // grant permanen tanpa expiry + pending downgrade -> jangan activate, biar B2 handle instan bypass
    await pool.query(
      `UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=NULL,
              plan_pending_package_id=$3, plan_pending_duration=30, plan_pending_created_at=now()
       WHERE id=$1`,
      [teamId, proId, basicId],
    );

    const usage = await getTeamUsage(teamId);
    // permanent Pro tetap aktif (expiry null means always active)
    expect(usage!.packageName).toBe('Pro');
    expect(usage!.pendingPackageId).toBe(basicId);

    const row = await getTeamRow(teamId);
    expect(row.plan_package_id).toBe(proId);
    expect(row.plan_pending_package_id).toBe(basicId);
    expect(row.plan_expires_at).toBeNull();
  });

  it('expired without pending falls back to Free (quota enforcement)', async () => {
    await pool.query(
      `UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now() - interval '1 day',
              plan_pending_package_id=NULL, plan_pending_duration=NULL, plan_pending_created_at=NULL
       WHERE id=$1`,
      [teamId, proId],
    );
    const usage = await getTeamUsage(teamId);
    expect(usage!.plan).toBe('free');
    expect(usage!.packageName).toBe('Free');
    expect(usage!.memberLimit).toBe(2);
    expect(usage!.projectLimit).toBe(3);
  });

  it('lazy activation is idempotent — second call does not double-extend', async () => {
    await pool.query(
      `UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now() - interval '1 hour',
              plan_pending_package_id=$3, plan_pending_duration=30, plan_pending_created_at=now()
       WHERE id=$1`,
      [teamId, proId, basicId],
    );
    const first = await getTeamUsage(teamId);
    const firstExpiry = (await getTeamRow(teamId)).plan_expires_at!.getTime();
    // second call should not re-apply (pending already cleared)
    const second = await getTeamUsage(teamId);
    const secondExpiry = (await getTeamRow(teamId)).plan_expires_at!.getTime();
    expect(first!.packageName).toBe('Basic');
    expect(second!.packageName).toBe('Basic');
    expect(secondExpiry).toBe(firstExpiry);
  });
});
