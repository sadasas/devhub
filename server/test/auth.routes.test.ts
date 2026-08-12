import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

describe('auth routes', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('registers a user and returns a session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'new@test.dev', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBe('new@test.dev');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('normalizes email to lowercase', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'MiXeD@Test.Dev', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('mixed@test.dev');
  });

  it('rejects a duplicate email with 409', async () => {
    await register('dup@test.dev');
    const res = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'dup@test.dev', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('rejects invalid emails and short passwords', async () => {
    const badEmail = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'not-an-email', password: 'password123' });
    expect(badEmail.status).toBe(400);

    const shortPw = await request(app)
      .post('/api/auth/register')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'ok@test.dev', password: 'short' });
    expect(shortPw.status).toBe(400);
  });

  it('creates a Personal team for new registrations', async () => {
    const cookie = await register('personal@test.dev');
    const res = await request(app)
      .get('/api/teams')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.teams[0].name).toBe('Personal');
    expect(res.body.teams[0].role).toBe('owner');
  });

  it('logs in with correct credentials', async () => {
    await register('login@test.dev');
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'login@test.dev', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects a wrong password', async () => {
    await register('login2@test.dev');
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'login2@test.dev', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('returns the current user from /me', async () => {
    const cookie = await register('me@test.dev');
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('me@test.dev');
  });

  it('rejects /me without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('logs out and clears the session cookie', async () => {
    const cookie = await register('out@test.dev');
    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(200);
    const setCookie = (logout.headers['set-cookie'] as unknown as string[] | undefined)?.[0];
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('changes the password and logs in with the new one', async () => {
    const cookie = await register('pw@test.dev');
    const change = await request(app)
      .patch('/api/auth/password')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'password123', newPassword: 'newpass456' });
    expect(change.status).toBe(200);
    expect(change.body).toEqual({ ok: true });

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'pw@test.dev', password: 'password123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'pw@test.dev', password: 'newpass456' });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a wrong current password', async () => {
    const cookie = await register('pw2@test.dev');
    const res = await request(app)
      .patch('/api/auth/password')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'wrong-password', newPassword: 'newpass456' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });

  it('rejects a weak or identical new password', async () => {
    const cookie = await register('pw3@test.dev');
    const weak = await request(app)
      .patch('/api/auth/password')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'password123', newPassword: 'short' });
    expect(weak.status).toBe(400);

    const same = await request(app)
      .patch('/api/auth/password')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'password123', newPassword: 'password123' });
    expect(same.status).toBe(400);
  });

  it('rejects password change without a session', async () => {
    const res = await request(app)
      .patch('/api/auth/password')
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'password123', newPassword: 'newpass456' });
    expect(res.status).toBe(401);
  });
});
