import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config.js';
import { app, getFirstTeamId, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

// Test negatif Tier 2 (BE MUST #3): verify server-to-server + idempoten +
// log filter header tetap utuh. Jangan ubah ke percaya body mentah —
// aktivasi HANYA bila GET /transactiondetail Pakasir balas
// { status:'completed', amount, order_id } yang cocok (billingService.ts:175-199).

function mockPakasirDetail(status: string, orderId: string, amount: number) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ transaction: { status, amount, order_id: orderId } }),
  });
}

async function getPro30(): Promise<{ id: string; priceId: string; amount: number }> {
  const pkg = await pool.query<{ id: string }>(
    "SELECT id FROM billing_packages WHERE name = 'Pro' AND is_active LIMIT 1",
  );
  const price = await pool.query<{ id: string; price_idr: number }>(
    'SELECT id, price_idr FROM billing_package_prices WHERE package_id = $1 AND duration_days = 30 AND is_active ORDER BY price_idr LIMIT 1',
    [pkg.rows[0]!.id],
  );
  return { id: pkg.rows[0]!.id, priceId: price.rows[0]!.id, amount: price.rows[0]!.price_idr };
}

async function teamExpiry(teamId: string): Promise<number | null> {
  const res = await pool.query<{ plan_expires_at: Date | null }>(
    'SELECT plan_expires_at FROM teams WHERE id = $1',
    [teamId],
  );
  return res.rows[0]?.plan_expires_at ? new Date(res.rows[0].plan_expires_at).getTime() : null;
}

describe('billing verify negatif: mismatch + double webhook (Tier 2)', () => {
  let owner: string;
  let teamId: string;

  beforeEach(async () => {
    await resetDb();
    owner = await register('neg-owner@test.dev');
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

  it('amount mismatch tetap 200 {ok:true} tanpa aktivasi ganda', async () => {
    const pro = await getPro30();
    const co = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ teamId, packageId: pro.id, priceId: pro.priceId });
    expect(co.status).toBe(200);

    // Verify S2S tidak dipanggil untuk mismatch (return dini sebelum fetch).
    const fetchMock = mockPakasirDetail('completed', co.body.orderId, pro.amount);
    vi.stubGlobal('fetch', fetchMock);
    const wrongAmount = pro.amount + 1;
    const res = await request(app)
      .post('/api/v1/billing/webhook')
      .send({ order_id: co.body.orderId, amount: wrongAmount });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();

    const pay = await pool.query<{ status: string }>(
      'SELECT status FROM team_payments WHERE order_id = $1',
      [co.body.orderId],
    );
    expect(pay.rows[0]?.status).toBe('pending');
    expect(await teamExpiry(teamId)).toBeNull();

    const log = await pool.query<{ verify_ok: boolean | null }>(
      'SELECT verify_ok FROM billing_webhook_logs WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
      [co.body.orderId],
    );
    expect(log.rows[0]?.verify_ok).toBeNull();
  });

  it('double webhook tetap 200 {ok:true} tanpa aktivasi ganda + header sensitif terfilter', async () => {
    const pro = await getPro30();
    const co = await request(app)
      .post('/api/v1/billing/checkout')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ teamId, packageId: pro.id, priceId: pro.priceId });
    expect(co.status).toBe(200);

    const fetchMock = mockPakasirDetail('completed', co.body.orderId, pro.amount);
    vi.stubGlobal('fetch', fetchMock);
    const body = { order_id: co.body.orderId, amount: pro.amount };

    const first = await request(app)
      .post('/api/v1/billing/webhook')
      .set('Authorization', 'Bearer secret-should-not-be-logged')
      .set('Cookie', 'session=should-not-be-logged')
      .set('X-Api-Key', 'key-should-not-be-logged')
      .send(body);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ ok: true });
    const firstExpiry = await teamExpiry(teamId);
    expect(firstExpiry).not.toBeNull();

    const second = await request(app).post('/api/v1/billing/webhook').send(body);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ ok: true });

    // Idempoten: S2S hanya sekali, expiry tidak bergeser (tanpa aktivasi ganda).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await teamExpiry(teamId)).toBe(firstExpiry);

    const pay = await pool.query<{ status: string }>(
      'SELECT status FROM team_payments WHERE order_id = $1',
      [co.body.orderId],
    );
    expect(pay.rows[0]?.status).toBe('completed');

    // Header sensitif tidak tersimpan (filterHeaders billingService.ts:207-217).
    const logs = await pool.query<{ headers: Record<string, unknown>; verify_ok: boolean | null }>(
      'SELECT headers, verify_ok FROM billing_webhook_logs WHERE order_id = $1 ORDER BY created_at',
      [co.body.orderId],
    );
    expect(logs.rows.length).toBe(2);
    expect(logs.rows[0]?.verify_ok).toBe(true);
    expect(logs.rows[1]?.verify_ok).toBeNull();
    const firstHeaders = logs.rows[0]?.headers ?? {};
    expect(firstHeaders).not.toHaveProperty('authorization');
    expect(firstHeaders).not.toHaveProperty('cookie');
    expect(firstHeaders).not.toHaveProperty('x-api-key');
    expect(JSON.stringify(firstHeaders)).not.toContain('should-not-be-logged');
  });
});
