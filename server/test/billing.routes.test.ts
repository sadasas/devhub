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
      `redirect=${encodeURIComponent(`https://app.test/billing/${teamId}`)}`,
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
});
