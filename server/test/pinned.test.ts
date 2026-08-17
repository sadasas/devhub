import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createProject, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/schema/state.js';

describe('pinned field (M13.7)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  const baseTask = {
    id: '66666666-6666-4666-8666-666666666666',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    title: 'Ship pins',
    status: 'todo',
    priority: 'medium',
    labels: [],
    blockedBy: [],
    description: '',
  };

  async function putAndGet(cookie: string, projectId: string, state: unknown) {
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
    return get.body.state;
  }

  it('round-trips pinned on all four entities', async () => {
    const cookie = await register('pin@test.dev');
    const projectId = await createProject(cookie);
    const state = {
      ...emptyState,
      tasks: [{ ...baseTask, pinned: true }],
      issues: [
        {
          id: '66666666-6666-4666-8666-666666666667',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          title: 'Pin me',
          severity: 'medium',
          status: 'open',
          description: '',
          reproduction: '',
          pinned: true,
        },
      ],
      testCases: [
        {
          id: '66666666-6666-4666-8666-666666666668',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          name: 'Pin test',
          steps: '',
          expected: '',
          status: 'pending',
          pinned: true,
        },
      ],
      decisions: [
        {
          id: '66666666-6666-4666-8666-666666666669',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          title: 'Pin decision',
          status: 'proposed',
          date: '2026-08-17',
          context: '',
          options: [],
          decision: '',
          consequences: '',
          pinned: true,
        },
      ],
    };

    const got = await putAndGet(cookie, projectId, state);
    expect(got.tasks[0].pinned).toBe(true);
    expect(got.issues[0].pinned).toBe(true);
    expect(got.testCases[0].pinned).toBe(true);
    expect(got.decisions[0].pinned).toBe(true);
  });

  it('defaults pinned to false when missing', async () => {
    const cookie = await register('pin2@test.dev');
    const projectId = await createProject(cookie);
    const state = { ...emptyState, tasks: [{ ...baseTask }] };

    const got = await putAndGet(cookie, projectId, state);
    expect(got.tasks[0].pinned).toBe(false);
  });

  it('strips unknown fields alongside pinned', async () => {
    const cookie = await register('pin3@test.dev');
    const projectId = await createProject(cookie);
    const state = { ...emptyState, tasks: [{ ...baseTask, pinned: false, bogusField: 'nope' }] };

    const got = await putAndGet(cookie, projectId, state);
    expect(got.tasks[0].pinned).toBe(false);
    expect(got.tasks[0].bogusField).toBeUndefined();
  });
});