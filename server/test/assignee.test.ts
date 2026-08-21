import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createProject, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/modules/projects/domain/state.js';

const ASSIGNEE = '77777777-7777-4777-8777-777777777777';

describe('task assigneeId (M24)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  const baseTask = {
    id: '88888888-8888-4888-8888-888888888888',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'Ship assignee',
    status: 'todo',
    priority: 'medium',
    labels: [],
    blockedBy: [],
    description: '',
  };

  it('round-trips assigneeId via PUT and GET state', async () => {
    const cookie = await register('assignee@test.dev');
    const projectId = await createProject(cookie);
    const state = { ...emptyState, tasks: [{ ...baseTask, assigneeId: ASSIGNEE }] };

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
    expect(get.body.state.tasks[0].assigneeId).toBe(ASSIGNEE);
  });

  it('preserves a null assigneeId and strips unknown task fields', async () => {
    const cookie = await register('assignee2@test.dev');
    const projectId = await createProject(cookie);
    const state = { ...emptyState, tasks: [{ ...baseTask, assigneeId: null, bogusField: 'nope' }] };

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
    expect(task.assigneeId).toBeNull();
    expect(task.bogusField).toBeUndefined();
  });

  it('rejects a malformed assigneeId with 400', async () => {
    const cookie = await register('assignee3@test.dev');
    const projectId = await createProject(cookie);
    const state = { ...emptyState, tasks: [{ ...baseTask, assigneeId: 'not-a-uuid' }] };

    const put = await request(app)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state, version: 1 });
    expect(put.status).toBe(400);
  });
});