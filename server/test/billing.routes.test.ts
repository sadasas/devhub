import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config.js';
import {
  app,
  createProject,
  emailOf,
  getFirstTeamId,
  inviteUser,
  register,
  setTeamPlan,
  uniqueIp,
} from './helpers.js';
import { resetDb } from './setup.js';

const DAY = 86_400_000;

interface PkgRow {
  id: string;
  name: string;
  is_free: boolean;
  max_members: number | null;
  max_projects: number | null;
}

async function getProPackage(): Promise<PkgRow & { price30Id: string; price365Id: string }> {
  const pkg = await pool.query<PkgRow>(
    "SELECT id, name, is_free, max_members, max_projects FROM billing_packages WHERE name = 'Pro' AND is_active LIMIT 1",
  );
  const row = pkg.rows[0];
  const prices = await pool.query<{ id: string; duration_days: number }>(
    'SELECT id, duration_days FROM billing_package_prices WHERE package_id = $1 AND is_active ORDER BY duration_days',
    [row?.id ?? '00000000-0000-0000-0000-000000000000'],
  );
  const p30 = prices.rows.find((p) => p.duration_days === 30);
  const p365 = prices.rows.find((p) => p.duration_days === 365);
  if (!row || !p30 || !p365) {
    throw new Error(
      `Pro seed missing — row=${JSON.stringify(row ?? null)} prices=${JSON.stringify(prices.rows)}`,
    );
  }
  return { ...row, price30Id: p30.id, price365Id: p365.id };
}

function mockPakasirDetail(
  status: string,
  orderId: string,
  amount: number,
): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ transaction: { status, amount, order_id: orderId } }),
  });
}

async function createLimitedPackage(
  name: string,
  maxMembers: number | null,
  maxProjects: number | null,
  priceIdr = 100_000,
  durationDays = 30,
): Promise<{ id: string; name: string; max_members: number | null; max_projects: number | null; priceId: string }> {
  const pkgRes = await pool.query<{ id: string }>(
    `INSERT INTO billing_packages (name, description, is_free, max_members, max_projects, sort_order) VALUES ($1,'',false,$2,$3, 10) RETURNING id`,
    [name, maxMembers, maxProjects],
  );
  const pkgId = pkgRes.rows[0]!.id;
  const priceRes = await pool.query<{ id: string }>(
    `INSERT INTO billing_package_prices (package_id, duration_days, price_idr, sort_order) VALUES ($1,$2,$3,0) RETURNING id`,
    [pkgId, durationDays, priceIdr],
  );
  return { id: pkgId, name, max_members: maxMembers, max_projects: maxProjects, priceId: priceRes.rows[0]!.id };
}

async function getTeamPending(teamId: string) {
  const res = await pool.query<{
    plan_pending_package_id: string | null;
    plan_pending_duration: number | null;
    plan_pending_created_at: Date | null;
    plan_package_id: string | null;
    plan_expires_at: Date | null;
    plan: string;
  }>('SELECT plan_pending_package_id, plan_pending_duration, plan_pending_created_at, plan_package_id, plan_expires_at, plan FROM teams WHERE id = $1', [teamId]);
  return res.rows[0]!;
}

async function getTeamPlanRow(teamId: string) {
  const res = await pool.query<{ plan: string; plan_package_id: string | null; plan_expires_at: Date | null; plan_pending_package_id: string | null }>(
    'SELECT plan, plan_package_id, plan_expires_at, plan_pending_package_id FROM teams WHERE id = $1',
    [teamId],
  );
  return res.rows[0]!;
}

async function teamExpiresAt(teamId: string): Promise<Date | null> {
  const res = await pool.query<{ plan_expires_at: Date | null }>(
    'SELECT plan_expires_at FROM teams WHERE id = $1',
    [teamId],
  );
  return res.rows[0]?.plan_expires_at ?? null;
}

async function checkout(cookie: string, body: Record<string, unknown>) {
  return request(app)
    .post('/api/v1/billing/checkout')
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send(body);
}

describe('billing Pakasir + paket dinamis (ADR-044/045)', () => {
  let owner: string;
  let teamId: string;

  beforeEach(async () => {
    await resetDb();
    owner = await register('owner@test.dev');
    teamId = await getFirstTeamId(owner);
    config.PAKASIR_ENABLED = true;
    config.PAKASIR_SANDBOX = true;
    config.PAKASIR_SLUG = 'devhub-test';
    config.PAKASIR_API_KEY = 'test-key';
    config.APP_PUBLIC_URL = 'https://app.test';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('seeds default Free and Pro packages with prices', async () => {
    const res = await request(app).get('/api/v1/billing/packages');
    expect(res.status).toBe(200);
    const pkgs = res.body.packages as Array<{
      name: string;
      isFree: boolean;
      maxMembers: number | null;
      prices: Array<{ durationDays: number; priceIdr: number }>;
    }>;
    const free = pkgs.find((p) => p.isFree)!;
    expect(free).toMatchObject({ maxMembers: 2, maxProjects: 3 });
    const pro = pkgs.find((p) => p.name === 'Pro')!;
    expect(pro.maxMembers).toBeNull();
    expect(pro.prices).toMatchObject([
      { durationDays: 30, priceIdr: 250_000 },
      { durationDays: 365, priceIdr: 2_500_000 },
    ]);
  });

  it('checkout disabled → 403 BILLING_DISABLED', async () => {
    config.PAKASIR_ENABLED = false;
    const pro = await getProPackage();
    const res = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BILLING_DISABLED');
  });

  it('checkout creates pending payment with DB price and snapshot', async () => {
    const pro = await getProPackage();
    const res = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('https://app.pakasir.com/pay/devhub-test/250000');
    expect(res.body.url).toContain(`order_id=${encodeURIComponent(res.body.orderId)}`);
    expect(res.body.url).toContain(
      `redirect=${encodeURIComponent(`https://app.test/billing/${teamId}?orderId=${res.body.orderId}`)}`,
    );

    const row = await pool.query<{
      status: string;
      amount: number;
      package_name: string;
      duration_days: number;
    }>('SELECT status, amount, package_name, duration_days FROM team_payments WHERE order_id = $1', [
      res.body.orderId,
    ]);
    expect(row.rows[0]).toMatchObject({
      status: 'pending',
      amount: 250_000,
      package_name: 'Pro',
      duration_days: 30,
    });
  });

  it('rejects inactive package on checkout (404)', async () => {
    const pro = await getProPackage();
    await pool.query('UPDATE billing_packages SET is_active = false WHERE id = $1', [pro.id]);
    const res = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });
    expect(res.status).toBe(404);
  });

  it('non-admin member cannot checkout (403)', async () => {
    const editor = await register('editor@test.dev');
    await inviteUser(owner, editor, teamId, 'editor');
    const pro = await getProPackage();

    const res = await checkout(editor, { teamId, packageId: pro.id, priceId: pro.price30Id });
    expect(res.status).toBe(403);
  });

  it('webhook grants the purchased package for its duration', async () => {
    const pro = await getProPackage();
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });

    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 250_000));
    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .send({ order_id: co.body.orderId, amount: 250_000 });

    expect(res.body).toEqual({ ok: true });
    const expires = (await teamExpiresAt(teamId))!.getTime();
    expect(expires).toBeGreaterThan(Date.now() + 29 * DAY - 60_000);
    expect(expires).toBeLessThan(Date.now() + 31 * DAY + 60_000);

    const team = await pool.query<{ plan: string; plan_package_id: string | null }>(
      'SELECT plan, plan_package_id FROM teams WHERE id = $1',
      [teamId],
    );
    expect(team.rows[0]).toMatchObject({ plan: 'pro', plan_package_id: pro.id });
  });

  it('duplicate webhook is idempotent', async () => {
    const pro = await getProPackage();
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });
    const fetchMock = mockPakasirDetail('completed', co.body.orderId, 250_000);
    vi.stubGlobal('fetch', fetchMock);

    const body = { order_id: co.body.orderId, amount: 250_000 };
    await request(app).post('/api/v1/billing/webhook').send(body);
    const firstExpiry = await teamExpiresAt(teamId);

    const second = await request(app).post('/api/v1/billing/webhook').send(body);
    expect(second.body).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await teamExpiresAt(teamId))!.getTime()).toBe(firstExpiry!.getTime());
  });

  it('mismatched amount does not grant; unknown order silent; verify failure stays pending', async () => {
    const pro = await getProPackage();
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });

    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 999));
    const mismatch = await request(app)
      .post('/api/v1/billing/webhook')
      .send({ order_id: co.body.orderId, amount: 999 });
    expect(mismatch.body.ok).toBe(true);

    const unknown = await request(app)
      .post('/api/v1/billing/webhook')
      .send({ order_id: 'DH-nope', amount: 250_000 });
    expect(unknown.body).toEqual({ ok: true });

    vi.stubGlobal('fetch', mockPakasirDetail('pending', co.body.orderId, 250_000));
    const fail = await request(app)
      .post('/api/v1/billing/webhook')
      .send({ order_id: co.body.orderId, amount: 250_000 });
    expect(fail.body).toEqual({ ok: false });

    const row = await pool.query<{ status: string }>(
      'SELECT status FROM team_payments WHERE order_id = $1',
      [co.body.orderId],
    );
    expect(row.rows[0]?.status).toBe('pending');
    expect(await teamExpiresAt(teamId)).toBeNull();
  });

  it('extension stacks from existing expiry (yearly on top of remaining days)', async () => {
    const oldExpiry = Date.now() + 10 * DAY;
    await pool.query(
      "UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=$3 WHERE id=$1",
      [teamId, (await getProPackage()).id, new Date(oldExpiry)],
    );
    const pro = await getProPackage();
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price365Id });

    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 2_500_000));
    await request(app)
      .post('/api/v1/billing/webhook')
      .send({ order_id: co.body.orderId, amount: 2_500_000 });

    const expires = (await teamExpiresAt(teamId))!.getTime();
    expect(expires).toBeGreaterThan(oldExpiry + 364 * DAY);
    expect(expires).toBeLessThan(oldExpiry + 366 * DAY + 60_000);
  });

  it('expired entitlement reverts to Free limits (4th project blocked)', async () => {
    const pro = await getProPackage();
    await pool.query(
      "UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now() - interval '1 day' WHERE id=$1",
      [teamId, pro.id],
    );
    for (let i = 0; i < 3; i++) await createProject(owner, `P${i}`, teamId);

    const res = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'P4', teamId });
    expect(res.status).toBe(402);
    expect(res.body.error.details).toMatchObject({ resource: 'projects', limit: 3 });
  });

  it('deactivated package is grandfathered for active workspace but hidden from new purchases', async () => {
    const pro = await getProPackage();
    await setTeamPlan(teamId, 'pro');
    await pool.query('UPDATE billing_packages SET is_active = false WHERE id = $1', [pro.id]);

    // Workspace tetap unlimited sampai kedaluwarsa…
    const ok = await createProject(owner, 'P1', teamId);
    expect(ok).toBeDefined();

    // …tapi hilang dari daftar publik & tidak bisa dibeli ulang.
    const list = await request(app).get('/api/v1/billing/packages');
    expect((list.body.packages as Array<{ id: string }>).some((p) => p.id === pro.id)).toBe(false);
    const rebuy = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });
    expect(rebuy.status).toBe(404);
  });

  it('admin manages packages: create, patch prices, delete guards', async () => {
    const adminEmail = 'platform-admin@test.dev';
    const admin = await register(adminEmail);
    await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);

    const created = await request(app)
      .post('/api/v1/admin/packages')
      .set('Cookie', admin)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        name: 'Basic',
        description: 'Starter tier',
        maxMembers: 3,
        maxProjects: 5,
        sortOrder: 0,
        prices: [
          { durationDays: 30, priceIdr: 99_000 },
          { durationDays: 90, priceIdr: 249_000 },
        ],
      });
    expect(created.status).toBe(201);
    const basicId = created.body.id as string;
    expect(created.body.prices).toHaveLength(2);

    // PATCH mengganti harga secara menyeluruh (90 hari dinonaktifkan).
    const patched = await request(app)
      .patch(`/api/v1/admin/packages/${basicId}`)
      .set('Cookie', admin)
      .set('X-Forwarded-For', uniqueIp())
      .send({ prices: [{ durationDays: 30, priceIdr: 89_000 }] });
    expect(patched.status).toBe(200);
    const activePrices = (patched.body.prices as Array<{ isActive: boolean; durationDays: number; priceIdr: number }>).filter(
      (p) => p.isActive,
    );
    expect(activePrices).toHaveLength(1);
    expect(activePrices[0]).toMatchObject({ durationDays: 30, priceIdr: 89_000 });

    // Duplikat free → 409.
    const dupFree = await request(app)
      .post('/api/v1/admin/packages')
      .set('Cookie', admin)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Free2', isFree: true });
    expect(dupFree.status).toBe(409);

    // DELETE dipakai pembayaran → 409.
    const pro = await getProPackage();
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });
    const delUsed = await request(app)
      .delete(`/api/v1/admin/packages/${pro.id}`)
      .set('Cookie', admin)
      .set('X-Forwarded-For', uniqueIp());
    void co;
    expect(delUsed.status).toBe(409);

    // DELETE belum terpakai → ok.
    const delNew = await request(app)
      .delete(`/api/v1/admin/packages/${basicId}`)
      .set('Cookie', admin)
      .set('X-Forwarded-For', uniqueIp());
    expect(delNew.status).toBe(200);

    // Non-admin dilarang.
    const forbidden = await request(app)
      .get('/api/v1/admin/packages')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(forbidden.status).toBe(403);
  });

  it('admin editing Free limits applies immediately to quotas', async () => {
    const adminEmail = 'platform-admin@test.dev';
    const admin = await register(adminEmail);
    await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [adminEmail]);
    const freeId = await pool
      .query<{ id: string }>('SELECT id FROM billing_packages WHERE is_free')
      .then((r) => r.rows[0]!.id);

    await request(app)
      .patch(`/api/v1/admin/packages/${freeId}`)
      .set('Cookie', admin)
      .set('X-Forwarded-For', uniqueIp())
      .send({ maxProjects: 1 });

    await createProject(owner, 'P1', teamId);
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'P2', teamId });
    expect(res.status).toBe(402);
    expect(res.body.error.details).toMatchObject({ resource: 'projects', limit: 1 });
  });

  it('resume reconstructs deterministic URL for own pending payment', async () => {
    const pro = await getProPackage();
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });

    const res = await request(app)
      .get(`/api/v1/billing/resume/${co.body.orderId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('https://app.pakasir.com/pay/devhub-test/250000');
    expect(res.body.url).toContain(`order_id=${encodeURIComponent(co.body.orderId)}`);
    expect(res.body.url).toContain(
      `redirect=${encodeURIComponent(`https://app.test/billing/${teamId}?orderId=${co.body.orderId}`)}`,
    );
  });

  it('resume rejects completed payment (409) and unknown order (404)', async () => {
    const pro = await getProPackage();
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });

    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 250_000));
    await request(app)
      .post('/api/v1/billing/webhook')
      .send({ order_id: co.body.orderId, amount: 250_000 });

    const done = await request(app)
      .get(`/api/v1/billing/resume/${co.body.orderId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(done.status).toBe(409);

    const missing = await request(app)
      .get('/api/v1/billing/resume/DH-nope')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(missing.status).toBe(404);
  });

  it('resume access: stranger 404, team admin 200', async () => {
    const pro = await getProPackage();
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });

    const stranger = await register('stranger@test.dev');
    const forbidden = await request(app)
      .get(`/api/v1/billing/resume/${co.body.orderId}`)
      .set('Cookie', stranger)
      .set('X-Forwarded-For', uniqueIp());
    expect(forbidden.status).toBe(404);

    const teamAdmin = await register('tadmin@test.dev');
    await inviteUser(owner, teamAdmin, teamId, 'admin');
    const allowed = await request(app)
      .get(`/api/v1/billing/resume/${co.body.orderId}`)
      .set('Cookie', teamAdmin)
      .set('X-Forwarded-For', uniqueIp());
    expect(allowed.status).toBe(200);
  });

  it('cancel marks pending cancelled; double cancel 409; completed 409', async () => {
    const pro = await getProPackage();
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });

    const res = await request(app)
      .post(`/api/v1/billing/cancel/${co.body.orderId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const row = await pool.query<{ status: string }>(
      'SELECT status FROM team_payments WHERE order_id = $1',
      [co.body.orderId],
    );
    expect(row.rows[0]?.status).toBe('cancelled');

    const again = await request(app)
      .post(`/api/v1/billing/cancel/${co.body.orderId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(again.status).toBe(409);

    const co2 = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });
    vi.stubGlobal('fetch', mockPakasirDetail('completed', co2.body.orderId, 250_000));
    await request(app)
      .post('/api/v1/billing/webhook')
      .send({ order_id: co2.body.orderId, amount: 250_000 });
    const cancelDone = await request(app)
      .post(`/api/v1/billing/cancel/${co2.body.orderId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(cancelDone.status).toBe(409);
  });

  it('webhook after cancel does not activate the plan', async () => {
    const pro = await getProPackage();
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });
    await request(app)
      .post(`/api/v1/billing/cancel/${co.body.orderId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());

    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 250_000));
    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .send({ order_id: co.body.orderId, amount: 250_000 });

    const row = await pool.query<{ status: string }>(
      'SELECT status FROM team_payments WHERE order_id = $1',
      [co.body.orderId],
    );
    expect(row.rows[0]?.status).toBe('cancelled');
    expect(await teamExpiresAt(teamId)).toBeNull();
  });

  // ---------- B2: renewal / upgrade / downgrade + pending lazy ----------

  it('downgrade checkout blocked when project count exceeds target limit (402 PLAN_LIMIT)', async () => {
    // Basic 5 proyek / 10 member → dari Pro unlimited adalah downgrade
    const basic = await createLimitedPackage('Basic', 10, 5, 100_000, 30);
    await pool.query("UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now()+interval '10 days' WHERE id=$1", [teamId, (await getProPackage()).id]);
    for (let i = 0; i < 6; i++) await createProject(owner, `P${i}`, teamId);
    const paymentsBefore = await pool.query('SELECT count(*)::int as n FROM team_payments');
    const res = await checkout(owner, { teamId, packageId: basic.id, priceId: basic.priceId });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PLAN_LIMIT');
    expect(res.body.error.details).toMatchObject({ resource: 'projects', limit: 5, used: 6, pendingPackageName: 'Basic' });
    const paymentsAfter = await pool.query('SELECT count(*)::int as n FROM team_payments');
    expect(paymentsAfter.rows[0].n).toBe(paymentsBefore.rows[0].n); // jangan insert pending_payment
  });

  it('downgrade checkout blocked when member count exceeds target limit (402)', async () => {
    const small = await createLimitedPackage('Small', 2, null, 80_000, 30);
    await pool.query("UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now()+interval '10 days' WHERE id=$1", [teamId, (await getProPackage()).id]);
    const u2 = await register('u2@test.dev');
    const u3 = await register('u3@test.dev');
    await inviteUser(owner, u2, teamId, 'editor');
    await inviteUser(owner, u3, teamId, 'editor');
    // sekarang memberCount = 3 > limit 2
    const res = await checkout(owner, { teamId, packageId: small.id, priceId: small.priceId });
    expect(res.status).toBe(402);
    expect(res.body.error.details).toMatchObject({ resource: 'members', limit: 2, used: 3 });
  });

  it('downgrade checkout allowed within limit and webhook schedules pending (not instant)', async () => {
    const basic = await createLimitedPackage('Basic', 10, 5, 100_000, 30);
    const pro = await getProPackage();
    await pool.query("UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now()+interval '10 days', plan_pending_package_id=NULL WHERE id=$1", [teamId, pro.id]);
    for (let i = 0; i < 3; i++) await createProject(owner, `P${i}`, teamId);
    const co = await checkout(owner, { teamId, packageId: basic.id, priceId: basic.priceId });
    expect(co.status).toBe(200);
    const pendingRowBefore = await getTeamPending(teamId);
    expect(pendingRowBefore.plan_pending_package_id).toBeNull();
    expect(pendingRowBefore.plan_package_id).toBe(pro.id);
    const expiresBefore = pendingRowBefore.plan_expires_at!.getTime();

    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 100_000));
    const wh = await request(app).post('/api/v1/billing/webhook').send({ order_id: co.body.orderId, amount: 100_000 });
    expect(wh.body).toEqual({ ok: true });

    const after = await getTeamPending(teamId);
    expect(after.plan_package_id).toBe(pro.id); // masih Pro, belum instan
    expect(after.plan_pending_package_id).toBe(basic.id);
    expect(after.plan_pending_duration).toBe(30);
    expect(after.plan_pending_created_at).not.toBeNull();
    // expiry tidak berubah (belum GREATEST)
    expect(after.plan_expires_at!.getTime()).toBe(expiresBefore);
    // pembayaran completed
    const pay = await pool.query<{ status: string }>('SELECT status FROM team_payments WHERE order_id=$1', [co.body.orderId]);
    expect(pay.rows[0].status).toBe('completed');
  });

  it('downgrade pending activates lazily after expiry (tanpa cron)', async () => {
    const basic = await createLimitedPackage('Basic', 10, 5, 100_000, 30);
    const pro = await getProPackage();
    await pool.query("UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now()+interval '10 days' WHERE id=$1", [teamId, pro.id]);
    const co = await checkout(owner, { teamId, packageId: basic.id, priceId: basic.priceId });
    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 100_000));
    await request(app).post('/api/v1/billing/webhook').send({ order_id: co.body.orderId, amount: 100_000 });

    // paksa expiry lewat
    await pool.query("UPDATE teams SET plan_expires_at = now() - interval '1 minute' WHERE id=$1", [teamId]);
    const before = await getTeamPending(teamId);
    expect(before.plan_pending_package_id).toBe(basic.id);

    // trigger lazy activation via getBillingOverview / getEffectiveUsage
    const overview = await request(app).get(`/api/v1/billing/status/${teamId}`).set('Cookie', owner).set('X-Forwarded-For', uniqueIp());
    expect(overview.status).toBe(200);

    const after = await getTeamPending(teamId);
    expect(after.plan_package_id).toBe(basic.id);
    expect(after.plan_pending_package_id).toBeNull();
    expect(after.plan_pending_duration).toBeNull();
    expect(after.plan_pending_created_at).toBeNull();
    expect(after.plan_expires_at!.getTime()).toBeGreaterThan(Date.now() + 29 * DAY - 60_000);
    expect(overview.body.usage.projects.limit).toBe(5);
    expect(overview.body.team.planPackageName).toBe('Basic');
  });

  it('downgrade with permanent grant (plan_expires_at NULL) bypasses pending and is instant', async () => {
    const basic = await createLimitedPackage('Basic', 10, 5, 100_000, 30);
    const pro = await getProPackage();
    // grant permanen
    await pool.query("UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=NULL, plan_pending_package_id=NULL WHERE id=$1", [teamId, pro.id]);
    const co = await checkout(owner, { teamId, packageId: basic.id, priceId: basic.priceId });
    expect(co.status).toBe(200);
    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 100_000));
    await request(app).post('/api/v1/billing/webhook').send({ order_id: co.body.orderId, amount: 100_000 });

    const after = await getTeamPending(teamId);
    expect(after.plan_package_id).toBe(basic.id);
    expect(after.plan_pending_package_id).toBeNull();
    expect(after.plan_expires_at).not.toBeNull();
    expect(after.plan_expires_at!.getTime()).toBeGreaterThan(Date.now() + 29 * DAY - 60_000);
  });

  it('upgrade from limited to Pro is instant and clears pending', async () => {
    const basic = await createLimitedPackage('Basic', 5, 5, 100_000, 30);
    const pro = await getProPackage();
    // tim di Basic dengan pending downgrade ke Small
    const small = await createLimitedPackage('Small', 2, 2, 50_000, 30);
    await pool.query("UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now()+interval '10 days', plan_pending_package_id=$3, plan_pending_duration=30, plan_pending_created_at=now() WHERE id=$1", [teamId, basic.id, small.id]);
    const beforePending = await getTeamPending(teamId);
    expect(beforePending.plan_pending_package_id).toBe(small.id);

    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });
    expect(co.status).toBe(200);
    const expiryBefore = (await getTeamPending(teamId)).plan_expires_at!.getTime();
    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 250_000));
    await request(app).post('/api/v1/billing/webhook').send({ order_id: co.body.orderId, amount: 250_000 });

    const after = await getTeamPending(teamId);
    expect(after.plan_package_id).toBe(pro.id);
    expect(after.plan_pending_package_id).toBeNull();
    expect(after.plan_expires_at!.getTime()).toBeGreaterThan(expiryBefore);
  });

  it('same package renewal stacks instantly (GREATEST) and keeps pending if any', async () => {
    const pro = await getProPackage();
    const basic = await createLimitedPackage('Basic', 5, 5, 80_000, 30);
    const startExpiry = Date.now() + 10 * DAY;
    await pool.query("UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=$3, plan_pending_package_id=$4, plan_pending_duration=30, plan_pending_created_at=now() WHERE id=$1", [teamId, pro.id, new Date(startExpiry), basic.id]);
    const co = await checkout(owner, { teamId, packageId: pro.id, priceId: pro.price30Id });
    expect(co.status).toBe(200);
    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 250_000));
    await request(app).post('/api/v1/billing/webhook').send({ order_id: co.body.orderId, amount: 250_000 });

    const after = await getTeamPending(teamId);
    expect(after.plan_package_id).toBe(pro.id);
    // pending tetap karena same-type tidak clear
    expect(after.plan_pending_package_id).toBe(basic.id);
    expect(after.plan_expires_at!.getTime()).toBeGreaterThan(startExpiry + 29 * DAY);
    expect(after.plan_expires_at!.getTime()).toBeLessThan(startExpiry + 31 * DAY + 60_000);
  });

  it('downgrade overwrites existing pending', async () => {
    const basic = await createLimitedPackage('Basic', 10, 5, 100_000, 30);
    const premium = await createLimitedPackage('Premium', 20, 20, 200_000, 30);
    const pro = await getProPackage();
    await pool.query("UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now()+interval '10 days', plan_pending_package_id=$3, plan_pending_duration=30 WHERE id=$1", [teamId, pro.id, premium.id]);
    const co = await checkout(owner, { teamId, packageId: basic.id, priceId: basic.priceId });
    expect(co.status).toBe(200);
    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 100_000));
    await request(app).post('/api/v1/billing/webhook').send({ order_id: co.body.orderId, amount: 100_000 });

    const after = await getTeamPending(teamId);
    expect(after.plan_pending_package_id).toBe(basic.id);
    expect(after.plan_pending_duration).toBe(30);
  });

  it('webhook downgrade is idempotent (second call does not re-schedule)', async () => {
    const basic = await createLimitedPackage('Basic', 10, 5, 100_000, 30);
    const pro = await getProPackage();
    await pool.query("UPDATE teams SET plan='pro', plan_package_id=$2, plan_expires_at=now()+interval '10 days' WHERE id=$1", [teamId, pro.id]);
    const co = await checkout(owner, { teamId, packageId: basic.id, priceId: basic.priceId });
    const fetchMock = mockPakasirDetail('completed', co.body.orderId, 100_000);
    vi.stubGlobal('fetch', fetchMock);
    const body = { order_id: co.body.orderId, amount: 100_000 };
    await request(app).post('/api/v1/billing/webhook').send(body);
    const firstPending = await getTeamPending(teamId);
    const second = await request(app).post('/api/v1/billing/webhook').send(body);
    expect(second.body).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const secondPending = await getTeamPending(teamId);
    expect(secondPending.plan_pending_package_id).toBe(firstPending.plan_pending_package_id);
    expect(secondPending.plan_expires_at!.getTime()).toBe(firstPending.plan_expires_at!.getTime());
  });
});
