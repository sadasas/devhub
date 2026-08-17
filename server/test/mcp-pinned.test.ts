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

async function readState(cookie: string, projectId: string) {
  const res = await request(app)
    .get(`/api/v1/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  return res.body.state;
}

describe('MCP pinned (M13.7)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates and pins a task', async () => {
    const cookie = await register('mcppin@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', { projectId, title: 'Ship pins', pinned: true });
    const state = await readState(cookie, projectId);
    expect(state.tasks[0].pinned).toBe(true);
  });

  it('unpins a task via update_task', async () => {
    const cookie = await register('mcppin2@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', { projectId, title: 'Ship pins', pinned: true });
    let state = await readState(cookie, projectId);
    const taskId = state.tasks[0].id;

    await toolCall(key, 'update_task', { projectId, taskId, pinned: false });
    state = await readState(cookie, projectId);
    expect(state.tasks[0].pinned).toBe(false);
  });

  it('pins an issue and a test case', async () => {
    const cookie = await register('mcppin3@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'add_issue', { projectId, title: 'Pin issue', pinned: true });
    await toolCall(key, 'add_test_case', { projectId, name: 'Pin test', pinned: true });
    const state = await readState(cookie, projectId);
    expect(state.issues[0].pinned).toBe(true);
    expect(state.testCases[0].pinned).toBe(true);
  });

  it('pins a decision at creation', async () => {
    const cookie = await register('mcppin4@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'add_decision', { projectId, title: 'Pin ADR', pinned: true });
    const state = await readState(cookie, projectId);
    expect(state.decisions[0].pinned).toBe(true);
  });

  it('defaults pinned to false when not provided', async () => {
    const cookie = await register('mcppin5@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'create_task', { projectId, title: 'Plain task' });
    const state = await readState(cookie, projectId);
    expect(state.tasks[0].pinned).toBe(false);
  });
});