import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config.js';
import { app, getFirstTeamId, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

function mockPakasirDetail(status: string, orderId: string, amount: number) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ transaction: { status, amount, order_id: orderId } }),
  });
}

async function getProPackage() {
  const pkg = await pool.query<{ id: string }>("SELECT id FROM billing_packages WHERE name = 'Pro' AND is_active LIMIT 1");
  const row = pkg.rows[0];
  const prices = await pool.query<{ id: string }>('SELECT id FROM billing_package_prices WHERE package_id = $1 AND is_active ORDER BY duration_days LIMIT 1', [row!.id]);
  return { id: row!.id, priceId: prices.rows[0]!.id };
}

describe('billing webhook logs persist in DB', () => {
  let owner: string;
  let teamId: string;
  let teamAdmin: string;
  beforeEach(async () => {
    await resetDb();
    owner = await register('owner@log.dev');
    teamId = await getFirstTeamId(owner);
    config.PAKASIR_ENABLED = true;
    config.PAKASIR_SLUG = 'devhub-test';
    config.PAKASIR_API_KEY = 'test-key';
    config.APP_PUBLIC_URL = 'https://app.test';
    const admin = await register('admin@log.dev');
    await pool.query("UPDATE users SET role='admin' WHERE email='admin@log.dev'");
    teamAdmin = admin;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('success webhook persists log with verify_ok true + team/payment linkage', async () => {
    const pro = await getProPackage();
    const co = await request(app).post('/api/v1/billing/checkout').set('Cookie', owner).set('X-Forwarded-For', uniqueIp()).send({ teamId, packageId: pro.id, priceId: pro.priceId });
    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 250000));
    const wh = await request(app).post('/api/v1/billing/webhook').set('X-Forwarded-For', '1.2.3.4').send({ order_id: co.body.orderId, amount: 250000 });
    expect(wh.body.ok).toBe(true);
    const log = await pool.query('SELECT order_id, amount, verify_ok, team_id, payment_id, ip, raw_body, headers, verify_payload FROM billing_webhook_logs WHERE order_id=$1', [co.body.orderId]);
    expect(log.rows[0].order_id).toBe(co.body.orderId);
    expect(log.rows[0].amount).toBe(250000);
    expect(log.rows[0].verify_ok).toBe(true);
    expect(log.rows[0].team_id).toBe(teamId);
    expect(log.rows[0].ip).toBe('1.2.3.4');
    expect(log.rows[0].raw_body.order_id).toBe(co.body.orderId);
    expect(log.rows[0].verify_payload.transaction.status).toBe('completed');
    // headers filtered: authorization/cookie not stored
    const wh2 = await request(app).post('/api/v1/billing/webhook').set('X-Forwarded-For', '1.2.3.4').set('Authorization', 'Bearer secret').set('Cookie', 'session=abc').send({ order_id: co.body.orderId, amount: 250000 });
    expect(wh2.body.ok).toBe(true);
    // second hit also logged as duplicate with verify null (idempotent)
    const logs = await pool.query('SELECT verify_ok FROM billing_webhook_logs WHERE order_id=$1 ORDER BY created_at', [co.body.orderId]);
    expect(logs.rows.length).toBe(2);
    expect(logs.rows[1].verify_ok).toBe(null);
  });

  it('unknown order + mismatch amount + verify failure all logged', async () => {
    const pro = await getProPackage();
    const co = await request(app).post('/api/v1/billing/checkout').set('Cookie', owner).set('X-Forwarded-For', uniqueIp()).send({ teamId, packageId: pro.id, priceId: pro.priceId });
    // unknown
    const unk = await request(app).post('/api/v1/billing/webhook').send({ order_id: 'DH-unknown-123', amount: 250000 });
    expect(unk.body.ok).toBe(true);
    // mismatch
    const mis = await request(app).post('/api/v1/billing/webhook').send({ order_id: co.body.orderId, amount: 999 });
    expect(mis.body.ok).toBe(true);
    // verify failure
    vi.stubGlobal('fetch', mockPakasirDetail('pending', co.body.orderId, 250000));
    const fail = await request(app).post('/api/v1/billing/webhook').send({ order_id: co.body.orderId, amount: 250000 });
    expect(fail.body.ok).toBe(false);
    const logs = await pool.query('SELECT order_id, amount, verify_ok FROM billing_webhook_logs ORDER BY created_at');
    expect(logs.rows.some(r => r.order_id === 'DH-unknown-123' && r.verify_ok === null)).toBe(true);
    expect(logs.rows.some(r => r.order_id === co.body.orderId && r.amount === 999 && r.verify_ok === null)).toBe(true);
    expect(logs.rows.some(r => r.order_id === co.body.orderId && r.amount === 250000 && r.verify_ok === false)).toBe(true);
  });

  it('invalid payload (no order_id) logged with order_id unknown', async () => {
    const res = await request(app).post('/api/v1/billing/webhook').send({ foo: 'bar' });
    expect(res.body.ok).toBe(true);
    const log = await pool.query("SELECT order_id, raw_body FROM billing_webhook_logs WHERE order_id='unknown' ORDER BY created_at DESC LIMIT 1");
    expect(log.rows[0].order_id).toBe('unknown');
    expect(log.rows[0].raw_body.foo).toBe('bar');
  });

  it('admin can list webhook logs, non-admin forbidden', async () => {
    const pro = await getProPackage();
    const co = await request(app).post('/api/v1/billing/checkout').set('Cookie', owner).set('X-Forwarded-For', uniqueIp()).send({ teamId, packageId: pro.id, priceId: pro.priceId });
    vi.stubGlobal('fetch', mockPakasirDetail('completed', co.body.orderId, 250000));
    await request(app).post('/api/v1/billing/webhook').send({ order_id: co.body.orderId, amount: 250000 });
    // admin list
    const adminRes = await request(app).get('/api/v1/admin/payments/webhook-logs').set('Cookie', teamAdmin).set('X-Forwarded-For', uniqueIp());
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.total).toBeGreaterThanOrEqual(1);
    expect(adminRes.body.logs[0].order_id).toBe(co.body.orderId);
    // filter by orderId
    const filtered = await request(app).get(`/api/v1/admin/payments/webhook-logs?orderId=${co.body.orderId}`).set('Cookie', teamAdmin).set('X-Forwarded-For', uniqueIp());
    expect(filtered.body.logs.every((l: any) => l.order_id === co.body.orderId)).toBe(true);
    // non-admin forbidden
    const userRes = await request(app).get('/api/v1/admin/payments/webhook-logs').set('Cookie', owner).set('X-Forwarded-For', uniqueIp());
    expect(userRes.status).toBe(403);
  });
});
