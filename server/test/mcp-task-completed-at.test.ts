import { beforeEach, describe, expect, it } from 'vitest';
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

async function readTasks(cookie: string, projectId: string) {
  const res = await request(app)
    .get(`/api/v1/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  return res.body.state.tasks as Array<{
    id: string;
    title: string;
    status: string;
    completedAt: string | null;
  }>;
}

describe('MCP task completedAt (M22)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a done task and auto-sets completedAt', async () => {
    const cookie = await register('mcpcomplete@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'create_task', {
      projectId,
      title: 'Ship gate',
      status: 'done',
    });
    expect(res.status).toBe(200);

    const tasks = await readTasks(cookie, projectId);
    expect(tasks[0].status).toBe('done');
    expect(tasks[0].completedAt).not.toBeNull();
  });

  it('keeps completedAt null for a todo task', async () => {
    const cookie = await register('mcpcomplete2@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', { projectId, title: 'Not done yet' });
    const tasks = await readTasks(cookie, projectId);
    expect(tasks[0].completedAt).toBeNull();
  });

  it('auto-sets completedAt when status moves to done and clears when leaving done', async () => {
    const cookie = await register('mcpcomplete3@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', { projectId, title: 'Ship gate' });
    let tasks = await readTasks(cookie, projectId);
    const taskId = tasks[0]!.id;
    expect(tasks[0].completedAt).toBeNull();

    await toolCall(key, 'update_task', { projectId, taskId, status: 'done' });
    tasks = await readTasks(cookie, projectId);
    expect(tasks[0].completedAt).not.toBeNull();

    const completedAt = tasks[0].completedAt;
    await toolCall(key, 'update_task', { projectId, taskId, status: 'review' });
    tasks = await readTasks(cookie, projectId);
    expect(tasks[0].completedAt).toBeNull();
    expect(completedAt).not.toBeNull();
  });

  it('keeps an explicit completedAt when provided', async () => {
    const cookie = await register('mcpcomplete4@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', {
      projectId,
      title: 'Ship gate',
      status: 'done',
      completedAt: '2026-08-10T00:00:00.000Z',
    });
    const tasks = await readTasks(cookie, projectId);
    expect(tasks[0].completedAt).toBe('2026-08-10T00:00:00.000Z');
  });

  it('rejects an invalid completedAt', async () => {
    const cookie = await register('mcpcomplete5@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'create_task', {
      projectId,
      title: 'Bad date',
      status: 'done',
      completedAt: 'not-a-date',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('-32602');
  });
});