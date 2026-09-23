import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app, register, createTeam, createProject, inviteUser, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { pool } from '../src/db/pool.js';
import { isAllowedMime } from '../src/modules/attachments/domain/attachment.js';

async function createTask(cookie: string, projectId: string, title = 'Bug task'): Promise<string> {
  const res = await request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ id: randomUUID(), title, status: 'todo', priority: 'high' });
  expect(res.status).toBe(201);
  return (res.body.entity as { id: string }).id;
}

async function getTask(cookie: string, projectId: string, taskId: string) {
  const res = await request(app)
    .get(`/api/v1/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', cookie);
  expect(res.status).toBe(200);
  return res.body.entity as { attachments?: Array<{ id: string; name: string }> };
}

describe('attachments (043)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('isAllowedMime allows docs/images/text/video, rejects executables', () => {
    expect(isAllowedMime('image/png')).toBe(true);
    expect(isAllowedMime('application/pdf')).toBe(true);
    expect(isAllowedMime('text/plain')).toBe(true);
    expect(isAllowedMime('video/mp4')).toBe(true);
    expect(isAllowedMime('video/webm')).toBe(true);
    expect(isAllowedMime('video/quicktime')).toBe(true);
    expect(isAllowedMime('application/x-sh')).toBe(false);
    expect(isAllowedMime('application/x-msdownload')).toBe(false);
    expect(isAllowedMime('')).toBe(false);
  });

  it('sign-upload is disabled without storage config (generic message)', async () => {
    const cookie = await register('att-a@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);
    const taskId = await createTask(cookie, projectId);
    const res = await request(app)
      .post('/api/v1/attachments/sign-upload')
      .set('Cookie', cookie)
      .send({ projectId, entity: 'tasks', entityId: taskId, name: 'a.png', mime: 'image/png', size: 100 });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('STORAGE_DISABLED');
    expect(JSON.stringify(res.body)).not.toMatch(/supabase/i);
  });

  it('link flow: add → listed on task → delete → gone', async () => {
    const cookie = await register('att-b@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);
    const taskId = await createTask(cookie, projectId);
    const add = await request(app)
      .post('/api/v1/attachments/link')
      .set('Cookie', cookie)
      .send({ projectId, entity: 'tasks', entityId: taskId, name: 'Spec', url: 'https://example.com/spec.pdf' });
    expect(add.status).toBe(201);
    const attId = (add.body.attachment as { id: string }).id;
    expect(add.body.attachment.provider).toBe('link');
    let task = await getTask(cookie, projectId, taskId);
    expect(task.attachments?.map((a) => a.id)).toContain(attId);
    const del = await request(app)
      .delete(`/api/v1/attachments/${projectId}/tasks/${taskId}/${attId}`)
      .set('Cookie', cookie);
    expect(del.status).toBe(200);
    task = await getTask(cookie, projectId, taskId);
    expect(task.attachments ?? []).toHaveLength(0);
    const del2 = await request(app)
      .delete(`/api/v1/attachments/${projectId}/tasks/${taskId}/${attId}`)
      .set('Cookie', cookie);
    expect(del2.status).toBe(404);
  });

  it('viewer cannot link (403), rejects bad url (400)', async () => {
    const owner = await register('att-c@gmail.com');
    const viewer = await register('att-d@gmail.com');
    const teamId = await createTeam(owner);
    const projectId = await createProject(owner, 'P', teamId);
    const taskId = await createTask(owner, projectId);
    await inviteUser(owner, viewer, teamId, 'viewer');
    const denied = await request(app)
      .post('/api/v1/attachments/link')
      .set('Cookie', viewer)
      .send({ projectId, entity: 'tasks', entityId: taskId, name: 'x', url: 'https://example.com/x' });
    expect(denied.status).toBe(403);
    const bad = await request(app)
      .post('/api/v1/attachments/link')
      .set('Cookie', owner)
      .send({ projectId, entity: 'tasks', entityId: taskId, name: 'x', url: 'notaurl' });
    expect(bad.status).toBe(400);
  });

  it('confirm enforces storage quota on Free (402 PLAN_LIMIT resource storage)', async () => {
    const cookie = await register('att-e@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);
    const taskId = await createTask(cookie, projectId);
    const fakeKey = `${teamId}/${projectId}/tasks/${taskId}/abc-file.png`;
    const res = await request(app)
      .post('/api/v1/attachments/confirm')
      .set('Cookie', cookie)
      .send({
        projectId,
        entity: 'tasks',
        entityId: taskId,
        attachment: {
          id: '11111111-1111-4111-8111-111111111111',
          provider: 'devhub',
          name: 'file.png',
          mime: 'image/png',
          size: 1024,
          storageKey: fakeKey,
          url: null,
          linkedAt: new Date().toISOString(),
        },
      });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PLAN_LIMIT');
    expect(res.body.error.details.resource).toBe('storage');
  });

  it('confirm on Pro reserves quota, delete releases it', async () => {
    const cookie = await register('att-f@gmail.com');
    const teamId = await createTeam(cookie);
    await pool.query(
      `UPDATE teams SET plan = 'pro',
         plan_package_id = (SELECT id FROM billing_packages WHERE is_active AND NOT is_free ORDER BY sort_order, created_at LIMIT 1),
         plan_expires_at = now() + interval '30 days' WHERE id = $1`,
      [teamId],
    );
    const projectId = await createProject(cookie, 'P', teamId);
    const taskId = await createTask(cookie, projectId);
    const fakeKey = `${teamId}/${projectId}/tasks/${taskId}/abc-file.png`;
    const att = {
      id: '22222222-2222-4222-8222-222222222222',
      provider: 'devhub',
      name: 'file.png',
      mime: 'image/png',
      size: 2048,
      storageKey: fakeKey,
      url: null,
      linkedAt: new Date().toISOString(),
    };
    const ok = await request(app)
      .post('/api/v1/attachments/confirm')
      .set('Cookie', cookie)
      .send({ projectId, entity: 'tasks', entityId: taskId, attachment: att });
    expect(ok.status).toBe(201);
    let used = await pool.query<{ storage_used_bytes: string }>(
      'SELECT storage_used_bytes FROM teams WHERE id = $1',
      [teamId],
    );
    expect(Number(used.rows[0]!.storage_used_bytes)).toBe(2048);
    const del = await request(app)
      .delete(`/api/v1/attachments/${projectId}/tasks/${taskId}/${att.id}`)
      .set('Cookie', cookie);
    expect(del.status).toBe(200);
    used = await pool.query<{ storage_used_bytes: string }>(
      'SELECT storage_used_bytes FROM teams WHERE id = $1',
      [teamId],
    );
    expect(Number(used.rows[0]!.storage_used_bytes)).toBe(0);
  });

  it('billing status exposes storage usage; packages expose maxStorageBytes', async () => {
    const cookie = await register('att-g@gmail.com');
    const teamId = await createTeam(cookie);
    const status = await request(app)
      .get(`/api/v1/billing/status/${teamId}`)
      .set('Cookie', cookie);
    expect(status.status).toBe(200);
    expect(status.body.usage.storage).toMatchObject({ usedBytes: 0, limitBytes: 0 });
    const pkgs = await request(app).get('/api/v1/billing/packages');
    expect(pkgs.status).toBe(200);
    const free = (pkgs.body.packages as Array<{ isFree: boolean; maxStorageBytes: number | null }>).find(
      (p) => p.isFree,
    );
    expect(free?.maxStorageBytes).toBe(0);
    const pro = (pkgs.body.packages as Array<{ isFree: boolean; maxStorageBytes: number | null }>).find(
      (p) => !p.isFree,
    );
    expect(pro?.maxStorageBytes).toBe(104857600);
  });

  it('create task with staged devhub attachments reserves quota on Pro', async () => {
    const cookie = await register('att-h@gmail.com');
    const teamId = await createTeam(cookie);
    await pool.query(
      `UPDATE teams SET plan = 'pro',
         plan_package_id = (SELECT id FROM billing_packages WHERE is_active AND NOT is_free ORDER BY sort_order, created_at LIMIT 1),
         plan_expires_at = now() + interval '30 days' WHERE id = $1`,
      [teamId],
    );
    const projectId = await createProject(cookie, 'P', teamId);
    const taskId = '33333333-3333-4333-8333-333333333333';
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: taskId,
        title: 'Staged',
        status: 'todo',
        priority: 'medium',
        attachments: [
          {
            id: '33333333-3333-4333-8333-333333333334',
            provider: 'devhub',
            name: 'staged.png',
            mime: 'image/png',
            size: 4096,
            storageKey: `${teamId}/${projectId}/tasks/${taskId}/x-staged.png`,
            url: null,
            linkedAt: new Date().toISOString(),
          },
        ],
      });
    expect(res.status).toBe(201);
    const used = await pool.query<{ storage_used_bytes: string }>(
      'SELECT storage_used_bytes FROM teams WHERE id = $1',
      [teamId],
    );
    expect(Number(used.rows[0]!.storage_used_bytes)).toBe(4096);
  });

  it('create task with staged devhub attachments is blocked on Free (402)', async () => {
    const cookie = await register('att-i@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);
    const taskId = '44444444-4444-4444-8444-444444444444';
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: taskId,
        title: 'Staged free',
        status: 'todo',
        priority: 'medium',
        attachments: [
          {
            id: '44444444-4444-4444-8444-444444444445',
            provider: 'devhub',
            name: 'staged.png',
            mime: 'image/png',
            size: 1024,
            storageKey: `${teamId}/${projectId}/tasks/${taskId}/x-staged.png`,
            url: null,
            linkedAt: new Date().toISOString(),
          },
        ],
      });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PLAN_LIMIT');
    // Entity tidak jadi dibuat — tanpa sisa.
    const got = await request(app)
      .get(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie);
    expect(got.status).toBe(404);
  });

  it('abandon removes staged object; rejects foreign keys and strangers', async () => {
    const cookie = await register('att-j@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);
    const ok = await request(app)
      .post('/api/v1/attachments/abandon')
      .set('Cookie', cookie)
      .send({ projectId, storageKey: `${teamId}/${projectId}/tasks/draft/x.png` });
    // Storage tak terkonfigurasi di test → 503 dari klien storage, tapi validasi lolos.
    expect([200, 503]).toContain(ok.status);
    const foreign = await request(app)
      .post('/api/v1/attachments/abandon')
      .set('Cookie', cookie)
      .send({ projectId, storageKey: `other-team/${projectId}/tasks/draft/x.png` });
    expect(foreign.status).toBe(400);
    const stranger = await register('att-k@gmail.com');
    const denied = await request(app)
      .post('/api/v1/attachments/abandon')
      .set('Cookie', stranger)
      .send({ projectId, storageKey: `${teamId}/${projectId}/tasks/draft/x.png` });
    expect(denied.status).toBe(404);
  });

  it('unfurl requires auth, validates url, blocks SSRF targets', async () => {
    const anon = await request(app).get('/api/v1/attachments/unfurl').query({ url: 'https://example.com/x' });
    expect(anon.status).toBe(401);
    const cookie = await register('att-unfurl@gmail.com');
    const missing = await request(app).get('/api/v1/attachments/unfurl').set('Cookie', cookie);
    expect(missing.status).toBe(400);
    const bad = await request(app)
      .get('/api/v1/attachments/unfurl')
      .set('Cookie', cookie)
      .query({ url: 'notaurl' });
    expect(bad.status).toBe(400);
    for (const blocked of [
      'http://localhost:3000/admin',
      'http://127.0.0.1/secret',
      'http://10.0.0.5/',
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/',
    ]) {
      const res = await request(app)
        .get('/api/v1/attachments/unfurl')
        .set('Cookie', cookie)
        .query({ url: blocked });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
