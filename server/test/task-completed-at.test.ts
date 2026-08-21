import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createProject, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/modules/projects/domain/state.js';

describe('task completedAt (M22)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  const baseTask = {
    id: '55555555-5555-4555-8555-555555555555',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'Ship done gate',
    status: 'done',
    priority: 'medium',
    labels: [],
    blockedBy: [],
    description: '',
  };

  it('round-trips completedAt via PUT and GET state', async () => {
    const cookie = await register('complete@test.dev');
    const projectId = await createProject(cookie);
    const state = {
      ...emptyState,
      tasks: [{ ...baseTask, completedAt: '2026-08-15T09:30:00.000Z' }],
    };

    const put = await request(app)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state, version: 1 });
    expect(put.status).toBe(200);

    const get = await request(app)
      .get(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(get.status).toBe(200);
    expect(get.body.state.tasks[0].completedAt).toBe('2026-08-15T09:30:00.000Z');
  });

  it('preserves a null completedAt and strips unknown task fields', async () => {
    const cookie = await register('stripcomplete@test.dev');
    const projectId = await createProject(cookie);
    const state = {
      ...emptyState,
      tasks: [{ ...baseTask, completedAt: null, bogusField: 'nope' }],
    };

    const put = await request(app)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state, version: 1 });
    expect(put.status).toBe(200);

    const get = await request(app)
      .get(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    const task = get.body.state.tasks[0];
    expect(task.completedAt).toBeNull();
    expect(task.bogusField).toBeUndefined();
  });

  it('rejects an invalid completedAt with 400', async () => {
    const cookie = await register('badcomplete@test.dev');
    const projectId = await createProject(cookie);
    const state = {
      ...emptyState,
      tasks: [{ ...baseTask, completedAt: 'not-a-date' }],
    };

    const put = await request(app)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state, version: 1 });
    expect(put.status).toBe(400);
  });
});