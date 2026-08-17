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
  return res.body.state.tasks as Array<{ id: string; title: string; startDate: string | null }>;
}

describe('MCP task startDate (M20)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a task with a start date', async () => {
    const cookie = await register('mcpstart@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'create_task', {
      projectId,
      title: 'Ship timeline',
      startDate: '2026-08-14',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.content?.[0]?.text).toContain('Ship timeline');

    const tasks = await readTasks(cookie, projectId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].startDate).toBe('2026-08-14');
  });

  it('updates a task start date and clears it with null', async () => {
    const cookie = await register('mcpstart2@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', { projectId, title: 'Ship timeline' });
    let tasks = await readTasks(cookie, projectId);
    const taskId = tasks[0]!.id;

    await toolCall(key, 'update_task', { projectId, taskId, startDate: '2026-08-14' });
    tasks = await readTasks(cookie, projectId);
    expect(tasks[0]!.startDate).toBe('2026-08-14');

    await toolCall(key, 'update_task', { projectId, taskId, startDate: null });
    tasks = await readTasks(cookie, projectId);
    expect(tasks[0]!.startDate).toBeNull();
  });

  it('rejects an invalid start date', async () => {
    const cookie = await register('mcpstart3@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'create_task', {
      projectId,
      title: 'Bad date',
      startDate: 'not-a-date',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('-32602');
  });
});