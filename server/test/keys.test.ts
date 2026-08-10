import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { resetDb } from './setup.js';

const app = createApp();

let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `192.0.2.${ipCounter % 255}`;
}

async function register(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .set('X-Forwarded-For', uniqueIp())
    .send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] as unknown as string[] | undefined)?.[0];
  expect(cookie).toBeDefined();
  return cookie!.split(';')[0]!;
}

describe('API keys', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a key, returns the raw key once, then lists it', async () => {
    const cookie = await register('a@test.dev');

    const created = await request(app)
      .post('/api/keys')
      .set('Cookie', cookie)
      .send({ name: 'cli' });
    expect(created.status).toBe(201);
    const { id, name, prefix, key, createdAt } = created.body;
    expect(id).toBeTypeOf('string');
    expect(name).toBe('cli');
    expect(prefix).toHaveLength(8);
    expect(key).toMatch(/^devhub_/);
    expect(key.slice(0, 8)).toBe(prefix);
    expect(createdAt).toBeTypeOf('string');

    const listed = await request(app).get('/api/keys').set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.keys).toHaveLength(1);
    expect(listed.body.keys[0]).toMatchObject({ id, name: 'cli', prefix });
    expect(listed.body.keys[0].revokedAt).toBeNull();
    expect(listed.body.keys[0].lastUsedAt).toBeNull();
    expect(JSON.stringify(listed.body)).not.toContain(key);
  });

  it('creates a key without a name', async () => {
    const cookie = await register('b@test.dev');
    const res = await request(app).post('/api/keys').set('Cookie', cookie).send({});
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('');
    expect(res.body.key).toMatch(/^devhub_/);
  });

  it('revokes a key (soft delete)', async () => {
    const cookie = await register('c@test.dev');
    const created = await request(app).post('/api/keys').set('Cookie', cookie).send({});
    const id = created.body.id as string;

    const revoked = await request(app).delete(`/api/keys/${id}`).set('Cookie', cookie);
    expect(revoked.status).toBe(200);
    expect(revoked.body).toEqual({ ok: true });

    const listed = await request(app).get('/api/keys').set('Cookie', cookie);
    expect(listed.body.keys[0].revokedAt).not.toBeNull();
  });

  it('requires authentication', async () => {
    const get = await request(app).get('/api/keys');
    expect(get.status).toBe(401);

    const post = await request(app).post('/api/keys').send({});
    expect(post.status).toBe(401);

    const del = await request(app).delete('/api/keys/some-id');
    expect(del.status).toBe(401);
  });

  it('rejects invalid payloads', async () => {
    const cookie = await register('d@test.dev');
    const res = await request(app)
      .post('/api/keys')
      .set('Cookie', cookie)
      .send({ name: 'x'.repeat(201) });
    expect(res.status).toBe(400);
  });

  it('cannot revoke another user key', async () => {
    const cookieA = await register('e@test.dev');
    const created = await request(app).post('/api/keys').set('Cookie', cookieA).send({});
    const id = created.body.id as string;

    const cookieB = await register('f@test.dev');
    const del = await request(app).delete(`/api/keys/${id}`).set('Cookie', cookieB);
    expect(del.status).toBe(404);

    const listed = await request(app).get('/api/keys').set('Cookie', cookieA);
    expect(listed.body.keys[0].revokedAt).toBeNull();
  });
});
