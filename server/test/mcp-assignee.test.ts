import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { TestAgent } from 'supertest';
import { app, createKey, createProject, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

const MCP_ACCEPT = 'application/json, text/event-stream';
const ASSIGNEE = '77777777-7777-4777-8777-777777777777';

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
  return res.body.state.tasks as Array<{ id: string; title: string; assigneeId: string | null }>;
}

describe('MCP task assigneeId (M24)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a task with an assignee', async () => {
    const cookie = await register('mcpassignee@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'create_task', {
      projectId,
      title: 'Ship assignee',
      assigneeId: ASSIGNEE,
    });
    expect(res.status).toBe(200);

    const tasks = await readTasks(cookie, projectId);
    expect(tasks[0].assigneeId).toBe(ASSIGNEE);
  });

  it('updates the assignee and clears it with null', async () => {
    const cookie = await register('mcpassignee2@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', { projectId, title: 'Ship assignee' });
    let tasks = await readTasks(cookie, projectId);
    const taskId = tasks[0]!.id;
    expect(tasks[0].assigneeId).toBeNull();

    await toolCall(key, 'update_task', { projectId, taskId, assigneeId: ASSIGNEE });
    tasks = await readTasks(cookie, projectId);
    expect(tasks[0].assigneeId).toBe(ASSIGNEE);

    await toolCall(key, 'update_task', { projectId, taskId, assigneeId: null });
    tasks = await readTasks(cookie, projectId);
    expect(tasks[0].assigneeId).toBeNull();
  });

  it('rejects an invalid assignee uuid', async () => {
    const cookie = await register('mcpassignee3@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'create_task', {
      projectId,
      title: 'Bad assignee',
      assigneeId: 'not-a-uuid',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('-32602');
  });
});