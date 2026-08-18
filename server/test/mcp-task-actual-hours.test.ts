import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { TestAgent } from 'supertest';
import { app, createKey, createProject, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

const MCP_ACCEPT = 'application/json, text/event-stream';

function mcpCall(key: string, body: unknown): TestAgent {
  const req = request(app)
    .post('/mcp')
    .set('Accept', MCP_ACCEPT)
    .set('X-Forwarded-For', uniqueIp());
  if (key) req.set('Authorization', `Bearer ${key}`);
  return req.send(body);
}

async function toolCall(key: string, name: string, args: Record<string, unknown>) {
  return mcpCall(key, {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  });
}

async function readTask(cookie: string, projectId: string) {
  const res = await request(app)
    .get(`/api/v1/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  return res.body.state.tasks[0] as {
    id: string;
    status: string;
    createdAt: string;
    startDate: string | null;
    completedAt: string | null;
    actualHours: number | null;
  };
}

describe('MCP task actualHours auto (M25)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-sets actualHours to 0 when creating a done task', async () => {
    const cookie = await register('mcphours1@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'create_task', { projectId, title: 'Ship gate', status: 'done' });
    expect(res.status).toBe(200);

    const task = await readTask(cookie, projectId);
    expect(task.status).toBe('done');
    expect(task.actualHours).toBe(0);
  });

  it('keeps an explicit actualHours when creating a done task', async () => {
    const cookie = await register('mcphours2@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', {
      projectId,
      title: 'Ship gate',
      status: 'done',
      actualHours: 3.5,
    });
    const task = await readTask(cookie, projectId);
    expect(task.actualHours).toBe(3.5);
  });

  it('computes actualHours from startDate to completedAt when moving to done', async () => {
    const cookie = await register('mcphours3@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'));
    await toolCall(key, 'create_task', {
      projectId,
      title: 'Ship gate',
      startDate: '2026-08-08',
    });

    vi.setSystemTime(new Date('2026-08-10T06:30:00.000Z'));
    await toolCall(key, 'update_task', { projectId, taskId: (await readTask(cookie, projectId)).id, status: 'done' });

    const task = await readTask(cookie, projectId);
    expect(task.completedAt).toBe('2026-08-10T06:30:00.000Z');
    expect(task.actualHours).toBe(54.5);
  });

  it('respects an explicit completedAt when moving to done', async () => {
    const cookie = await register('mcphours4@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', {
      projectId,
      title: 'Ship gate',
      startDate: '2026-08-08',
    });
    const taskId = (await readTask(cookie, projectId)).id;

    await toolCall(key, 'update_task', {
      projectId,
      taskId,
      status: 'done',
      completedAt: '2026-08-10T00:00:00.000Z',
    });
    const task = await readTask(cookie, projectId);
    expect(task.actualHours).toBe(48);
  });

  it('keeps an explicit actualHours when moving to done', async () => {
    const cookie = await register('mcphours5@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', { projectId, title: 'Ship gate' });
    const taskId = (await readTask(cookie, projectId)).id;

    await toolCall(key, 'update_task', {
      projectId,
      taskId,
      status: 'done',
      actualHours: 2.5,
    });
    const task = await readTask(cookie, projectId);
    expect(task.actualHours).toBe(2.5);
  });

  it('keeps actualHours when leaving done', async () => {
    const cookie = await register('mcphours6@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', { projectId, title: 'Ship gate' });
    const taskId = (await readTask(cookie, projectId)).id;

    await toolCall(key, 'update_task', { projectId, taskId, status: 'done', actualHours: 4 });
    await toolCall(key, 'update_task', { projectId, taskId, status: 'review' });

    const task = await readTask(cookie, projectId);
    expect(task.completedAt).toBeNull();
    expect(task.actualHours).toBe(4);
  });

  it('rejects actualHours with more than 1 decimal place', async () => {
    const cookie = await register('mcphours7@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'update_task', {
      projectId,
      taskId: '00000000-0000-4000-8000-000000000000',
      actualHours: 2.55,
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('-32602');
  });
});