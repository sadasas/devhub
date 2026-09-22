import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, register, uniqueIp } from './helpers.js';
import { config } from '../src/config.js';
import { pool } from '../src/db/pool.js';
import { resetDb } from './setup.js';

describe('auth routes', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('registers without auto-login and requires verification first (T6 hard gate)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'new@gmail.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBe('new@gmail.com');
    expect(res.headers['set-cookie']).toBeUndefined();
    // Login sebelum verifikasi ditolak.
    const blocked = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'new@gmail.com', password: 'password123' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('sets a host-only session cookie by default (no Domain attribute)', async () => {
    // Cookie sesi kini terbit saat login (register tidak auto-login sejak T6).
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'nodomain@gmail.com', password: 'password123' });
    const tok = await pool.query<{ token: string }>(
      `SELECT t.token FROM email_verify_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = 'nodomain@gmail.com'`,
    );
    await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: tok.rows[0]!.token });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'nodomain@gmail.com', password: 'password123' });
    expect(res.status).toBe(200);
    const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined)?.[0] ?? '';
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).not.toMatch(/Domain=/i);
  });

  it('sets Domain on the session cookie when COOKIE_DOMAIN is configured (ADR-051)', async () => {
    const prev = config.COOKIE_DOMAIN;
    config.COOKIE_DOMAIN = '.nrawangbatin.my.id';
    try {
      await request(app)
        .post('/api/v1/auth/register')
        .set('X-Forwarded-For', uniqueIp())
        .send({ email: 'parentdomain@gmail.com', password: 'password123' });
      const tok = await pool.query<{ token: string }>(
        `SELECT t.token FROM email_verify_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = 'parentdomain@gmail.com'`,
      );
      await request(app)
        .post('/api/v1/auth/verify-email')
        .set('X-Forwarded-For', uniqueIp())
        .send({ token: tok.rows[0]!.token });
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', uniqueIp())
        .send({ email: 'parentdomain@gmail.com', password: 'password123' });
      expect(res.status).toBe(200);
      const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined)?.[0] ?? '';
      expect(setCookie).toContain('Domain=.nrawangbatin.my.id');
    } finally {
      config.COOKIE_DOMAIN = prev;
    }
  });

  it('normalizes email to lowercase', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'MiXeD@gmail.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('mixed@gmail.com');
  });

  it('rejects a duplicate email with 409', async () => {
    await register('dup@gmail.com');
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'dup@gmail.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('rejects invalid emails and short passwords', async () => {
    const badEmail = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'not-an-email', password: 'password123' });
    expect(badEmail.status).toBe(400);

    const shortPw = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'ok@gmail.com', password: 'short' });
    expect(shortPw.status).toBe(400);
  });

  it('starts with zero teams for new registrations (no auto-create)', async () => {
    const cookie = await register('noteam@gmail.com');
    const res = await request(app)
      .get('/api/v1/teams')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(0);
  });

  it('logs in with correct credentials', async () => {
    await register('login@gmail.com');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'login@gmail.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects a wrong password', async () => {
    await register('login2@gmail.com');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'login2@gmail.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('returns the current user from /me', async () => {
    const cookie = await register('me@gmail.com');
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@gmail.com');
  });

  it('rejects /me without a session', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('logs out and clears the session cookie', async () => {
    const cookie = await register('out@gmail.com');
    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);
    const setCookie = (logout.headers['set-cookie'] as unknown as string[] | undefined)?.[0];
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('changes the password and logs in with the new one', async () => {
    const cookie = await register('pw@gmail.com');
    const change = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'password123', newPassword: 'newpass456' });
    expect(change.status).toBe(200);
    expect(change.body).toEqual({ ok: true });

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'pw@gmail.com', password: 'password123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'pw@gmail.com', password: 'newpass456' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a wrong current password', async () => {
    const cookie = await register('pw2@gmail.com');
    const res = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'wrong-password', newPassword: 'newpass456' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });

  it('rejects a weak or identical new password', async () => {
    const cookie = await register('pw3@gmail.com');
    const weak = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'password123', newPassword: 'short' });
    expect(weak.status).toBe(400);

    const same = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'password123', newPassword: 'password123' });
    expect(same.status).toBe(400);
  });

  it('rejects password change without a session', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'password123', newPassword: 'newpass456' });
    expect(res.status).toBe(401);
  });

  it('forgot-password enqueues reset email without leaking the token (M31)', async () => {
    await register('forgot1@gmail.com');
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'forgot1@gmail.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.token).toBeUndefined();
    const outbox = await pool.query<{ template: string; status: string }>(
      "SELECT template, status FROM mail_outbox WHERE to_email = 'forgot1@gmail.com' AND template = 'reset'",
    );
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0]).toMatchObject({ template: 'reset', status: 'pending' });
    const tokens = await pool.query<{ token: string }>(
      `SELECT t.token FROM password_reset_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = 'forgot1@gmail.com'`,
    );
    expect(tokens.rows).toHaveLength(1);
    // Full circle: token dari DB (test-only) → reset → login password baru.
    const reset = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: tokens.rows[0]!.token, newPassword: 'brandnew456' });
    expect(reset.status).toBe(200);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'forgot1@gmail.com', password: 'brandnew456' });
    expect(login.status).toBe(200);
  });

  it('forgot-password keeps single active token and answers ok for unknown email', async () => {
    await register('forgot2@gmail.com');
    const ip = uniqueIp();
    // NOTE: forgotLimiter 5/15m per IP — 2 request di bawah limit.
    await request(app).post('/api/v1/auth/forgot-password').set('X-Forwarded-For', ip).send({ email: 'forgot2@gmail.com' });
    await request(app).post('/api/v1/auth/forgot-password').set('X-Forwarded-For', ip).send({ email: 'forgot2@gmail.com' });
    const tokens = await pool.query<{ token: string }>(
      `SELECT t.token FROM password_reset_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = 'forgot2@gmail.com' AND t.used_at IS NULL`,
    );
    expect(tokens.rows).toHaveLength(1);
    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'nobody-here@test.dev' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.ok).toBe(true);
    expect(unknown.body.token).toBeUndefined();
  });

  it('register enqueues verify email and verify-email sets the flag (M31)', async () => {
    // Direct POST (tanpa helper yang auto-verify) agar pre-state teramati.
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'verify1@gmail.com', password: 'password123' });
    expect(reg.status).toBe(201);
    const outbox = await pool.query<{ template: string; status: string }>(
      "SELECT template, status FROM mail_outbox WHERE to_email = 'verify1@gmail.com' AND template = 'verify'",
    );
    expect(outbox.rows).toHaveLength(1);
    expect(outbox.rows[0]).toMatchObject({ template: 'verify', status: 'pending' });
    const before = await pool.query<{ email_verified: boolean }>(
      "SELECT email_verified FROM users WHERE email = 'verify1@gmail.com'",
    );
    expect(before.rows[0]?.email_verified).toBe(false);
    const tokens = await pool.query<{ token: string }>(
      `SELECT t.token FROM email_verify_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = 'verify1@gmail.com'`,
    );
    expect(tokens.rows).toHaveLength(1);
    const verify = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: tokens.rows[0]!.token });
    expect(verify.status).toBe(200);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'verify1@gmail.com', password: 'password123' });
    expect(login.status).toBe(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[] | undefined)?.[0]!.split(';')[0]!;
    const after = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(after.body.emailVerified).toBe(true);
    // Reuse token yang sama ditolak.
    const reuse = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: tokens.rows[0]!.token });
    expect(reuse.status).toBe(400);
    // Token ngawur ditolak.
    const bogus = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('X-Forwarded-For', uniqueIp())
      .send({ token: 'tidak-ada-token-ini-0123456789' });
    expect(bogus.status).toBe(400);
  });

  it('grandfather: legacy user logs in during grace with graceUntil, blocked after (T6/TC7)', async () => {
    // Simulasi user lama: register (unverified) lalu beri deadline seperti backfill 042.
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'legacy@gmail.com', password: 'password123' });
    await pool.query("UPDATE users SET verification_deadline = now() + interval '14 days' WHERE email = 'legacy@gmail.com'");

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'legacy@gmail.com', password: 'password123' });
    expect(login.status).toBe(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[] | undefined)?.[0]!.split(';')[0]!;
    const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);
    expect(me.body.emailVerified).toBe(false);
    expect(typeof me.body.graceUntil).toBe('string');

    // Simulasi lewat deadline → kena gate seperti user baru.
    await pool.query("UPDATE users SET verification_deadline = now() - interval '1 day' WHERE email = 'legacy@gmail.com'");
    const late = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'legacy@gmail.com', password: 'password123' });
    expect(late.status).toBe(403);
    expect(late.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('resend-verification issues a new token without enumeration (T6)', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'resend1@gmail.com', password: 'password123' });
    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'resend1@gmail.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Token lama dicabut, tepat 1 aktif.
    const tokens = await pool.query(
      `SELECT t.token FROM email_verify_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = 'resend1@gmail.com' AND t.used_at IS NULL`,
    );
    expect(tokens.rows).toHaveLength(1);
    // Email tak dikenal: tetap OK, tanpa bocor.
    const unknown = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'ghost-verify@test.dev' });
    expect(unknown.status).toBe(200);
    expect(unknown.body.ok).toBe(true);
  });
});

describe('forgot-password diam + throttle 1/jam per email', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function resetTokens(email: string): Promise<string[]> {
    const r = await pool.query<{ token: string }>(
      `SELECT t.token FROM password_reset_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = $1 ORDER BY t.created_at`,
      [email],
    );
    return r.rows.map((x) => x.token);
  }

  async function resetMails(email: string): Promise<number> {
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM mail_outbox WHERE to_email = $1 AND template = 'reset'`,
      [email],
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  async function forgot(email: string): Promise<{ status: number; body: unknown }> {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email });
    return { status: res.status, body: res.body as unknown };
  }

  it('email tak terdaftar: 200 generik, tanpa token, tanpa email keluar', async () => {
    const res = await forgot('ghost-forgot@test.dev');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    expect(await resetTokens('ghost-forgot@test.dev')).toHaveLength(0);
    expect(await resetMails('ghost-forgot@test.dev')).toBe(0);
  });

  it('format salah: 200 generik (diam), tanpa token, tanpa email keluar', async () => {
    const res = await forgot('bukan-email');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    expect(await resetTokens('bukan-email')).toHaveLength(0);
    expect(await resetMails('bukan-email')).toBe(0);
  });

  it('email terdaftar: 1 token + 1 email; request ke-2 <1 jam diam tanpa kirim lagi', async () => {
    await register('throttle1@gmail.com');
    const first = await forgot('throttle1@gmail.com');
    expect(first.status).toBe(200);
    expect(await resetTokens('throttle1@gmail.com')).toHaveLength(1);
    expect(await resetMails('throttle1@gmail.com')).toBe(1);

    const second = await forgot('throttle1@gmail.com');
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ ok: true });
    // Token tidak dibuat ulang, outbox tidak bertambah.
    expect(await resetTokens('throttle1@gmail.com')).toHaveLength(1);
    expect(await resetMails('throttle1@gmail.com')).toBe(1);
  });

  it('token kedaluwarsa: request baru diizinkan (link lama sudah mati)', async () => {
    await register('throttle2@gmail.com');
    await forgot('throttle2@gmail.com');
    expect(await resetMails('throttle2@gmail.com')).toBe(1);
    // Kedaluwarsakan token aktif secara manual.
    await pool.query(
      `UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute'
       WHERE user_id = (SELECT id FROM users WHERE email = 'throttle2@gmail.com')`,
    );
    const retry = await forgot('throttle2@gmail.com');
    expect(retry.status).toBe(200);
    // Token lama yang kedaluwarsa dicabut + 1 token segar; outbox bertambah 1.
    expect(await resetTokens('throttle2@gmail.com')).toHaveLength(1);
    expect(await resetMails('throttle2@gmail.com')).toBe(2);
  });
});
