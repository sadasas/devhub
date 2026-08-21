import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app, createProject, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { newId } from '../src/shared/ids.js';

async function createTask(
  cookie: string,
  projectId: string,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  const res = await request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ id: newId(), labels: [], blockedBy: [], description: '', ...body });
  expect(res.status).toBe(201);
  return res.body.entity as { id: string };
}

async function patchTask(
  cookie: string,
  projectId: string,
  taskId: string,
  body: Record<string, unknown>,
) {
  const res = await request(app)
    .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send(body);
  expect(res.status).toBe(200);
  return res.body.entity as {
    status: string;
    completedAt: string | null;
    actualHours: number | null;
  };
}

describe('task actualHours auto via REST (M25)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-derives completedAt and actualHours when PATCH moves a task to done', async () => {
    const cookie = await register('resthours1@test.dev');
    const projectId = await createProject(cookie);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'));
    const { id } = await createTask(cookie, projectId, {
      title: 'Ship gate',
      status: 'todo',
      priority: 'medium',
      startDate: '2026-08-08',
    });

    vi.setSystemTime(new Date('2026-08-10T06:30:00.000Z'));
    const item = await patchTask(cookie, projectId, id, { status: 'done' });
    expect(item.completedAt).toBe('2026-08-10T06:30:00.000Z');
    expect(item.actualHours).toBe(54.5);
  });

  it('auto-sets actualHours to 0 when creating a done task', async () => {
    const cookie = await register('resthours2@test.dev');
    const projectId = await createProject(cookie);

    const { id } = await createTask(cookie, projectId, {
      title: 'Ship gate',
      status: 'done',
      priority: 'medium',
    });
    const item = await patchTask(cookie, projectId, id, { title: 'Renamed' });
    expect(item.status).toBe('done');
    expect(item.completedAt).not.toBeNull();
    expect(item.actualHours).toBe(0);
  });

  it('respects explicit completedAt and actualHours in a PATCH', async () => {
    const cookie = await register('resthours3@test.dev');
    const projectId = await createProject(cookie);

    const { id } = await createTask(cookie, projectId, {
      title: 'Ship gate',
      status: 'todo',
      priority: 'medium',
      startDate: '2026-08-08',
    });
    const item = await patchTask(cookie, projectId, id, {
      status: 'done',
      completedAt: '2026-08-10T00:00:00.000Z',
      actualHours: 2.5,
    });
    expect(item.completedAt).toBe('2026-08-10T00:00:00.000Z');
    expect(item.actualHours).toBe(2.5);
  });

  it('derives actualHours from an explicit completedAt in a PATCH', async () => {
    const cookie = await register('resthours4@test.dev');
    const projectId = await createProject(cookie);

    const { id } = await createTask(cookie, projectId, {
      title: 'Ship gate',
      status: 'todo',
      priority: 'medium',
      startDate: '2026-08-08',
    });
    const item = await patchTask(cookie, projectId, id, {
      status: 'done',
      completedAt: '2026-08-10T00:00:00.000Z',
    });
    expect(item.actualHours).toBe(48);
  });

  it('keeps actualHours but clears completedAt when leaving done', async () => {
    const cookie = await register('resthours5@test.dev');
    const projectId = await createProject(cookie);

    const { id } = await createTask(cookie, projectId, {
      title: 'Ship gate',
      status: 'done',
      priority: 'medium',
    });
    await patchTask(cookie, projectId, id, { status: 'done', actualHours: 4 });
    const item = await patchTask(cookie, projectId, id, { status: 'review' });
    expect(item.completedAt).toBeNull();
    expect(item.actualHours).toBe(4);
  });

  it('does not recompute actualHours when re-setting status to done', async () => {
    const cookie = await register('resthours6@test.dev');
    const projectId = await createProject(cookie);

    const { id } = await createTask(cookie, projectId, {
      title: 'Ship gate',
      status: 'done',
      priority: 'medium',
    });
    await patchTask(cookie, projectId, id, { status: 'done', actualHours: 4 });
    const item = await patchTask(cookie, projectId, id, { status: 'done' });
    expect(item.actualHours).toBe(4);
  });

  it('rejects actualHours with more than 1 decimal place', async () => {
    const cookie = await register('resthours7@test.dev');
    const projectId = await createProject(cookie);

    const { id } = await createTask(cookie, projectId, {
      title: 'Ship gate',
      status: 'todo',
      priority: 'medium',
    });
    const res = await request(app)
      .patch(`/api/v1/projects/${projectId}/tasks/${id}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ actualHours: 2.55 });
    expect(res.status).toBe(400);
  });
});