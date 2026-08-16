import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { TestAgent } from 'supertest';
import { app, createKey, createProject, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

const MCP_ACCEPT = 'application/json, text/event-stream';
const API = '/api/v1';

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

async function toolText(key: string, name: string, args: Record<string, unknown>): Promise<string> {
  const res = await toolCall(key, name, args);
  expect(res.status).toBe(200);
  return (res.body.result?.content?.[0]?.text ?? '') as string;
}

interface ActivityRow {
  id: string;
  projectId: string;
  entity: string;
  entityId: string;
  action: string;
  authorId: string | null;
  authorName: string;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
}

async function fetchActivity(cookie: string, projectId: string, query = ''): Promise<ActivityRow[]> {
  const res = await request(app)
    .get(`${API}/projects/${projectId}/activity${query}`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  return res.body.items as ActivityRow[];
}

describe('MCP activity logging', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('records an MCP-created task in the project activity feed', async () => {
    const cookie = await register('mcp-activity-create@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const text = await toolText(key, 'create_task', { projectId, title: 'Ship MCP activity' });
    const taskId = JSON.parse(text).id as string;

    const items = await fetchActivity(cookie, projectId);
    const created = items.find((i) => i.entity === 'tasks' && i.entityId === taskId);
    expect(created).toBeTruthy();
    expect(created?.action).toBe('created');
    expect(created?.summary).toContain('Ship MCP activity');
    expect(created?.authorId).toBeTruthy();
  });

  it('records an update against the same entity row', async () => {
    const cookie = await register('mcp-activity-update@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const text = await toolText(key, 'create_task', { projectId, title: 'Update me' });
    const taskId = JSON.parse(text).id as string;

    await toolText(key, 'update_task', { projectId, taskId, status: 'inProgress' });

    const items = await fetchActivity(cookie, projectId, `?entity=tasks&entityId=${taskId}`);
    expect(items.map((i) => i.action).sort()).toEqual(['created', 'updated']);
  });

  it('records deletions of relations created over MCP', async () => {
    const cookie = await register('mcp-activity-delete@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    await toolText(key, 'add_table', {
      projectId,
      name: 'users',
      columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
    });
    await toolText(key, 'add_table', {
      projectId,
      name: 'posts',
      columns: [{ name: 'id', type: 'uuid', primaryKey: true }],
    });
    const stateRes = await request(app)
      .get(`${API}/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(stateRes.status).toBe(200);
    const tables = (stateRes.body.state.tables ?? []) as Array<{
      id: string;
      name: string;
      columns: Array<{ id: string; name: string }>;
    }>;
    const usersTable = tables.find((t) => t.name === 'users')!;
    const postsTable = tables.find((t) => t.name === 'posts')!;

    const relText = await toolText(key, 'add_relation', {
      projectId,
      fromTableId: usersTable.id,
      fromColumnId: usersTable.columns[0]!.id,
      toTableId: postsTable.id,
      toColumnId: postsTable.columns[0]!.id,
    });
    const relationId = JSON.parse(relText).id as string;

    await toolText(key, 'delete_relation', { projectId, relationId });

    const items = await fetchActivity(cookie, projectId);
    const deleted = items.find((i) => i.entity === 'relations' && i.entityId === relationId);
    expect(deleted).toBeTruthy();
    expect(deleted?.action).toBe('deleted');
  });

  it('does not log an updated row when a no-op update leaves the state unchanged', async () => {
    const cookie = await register('mcp-activity-noop@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const text = await toolText(key, 'create_task', { projectId, title: 'Same title' });
    const taskId = JSON.parse(text).id as string;

    const before = await fetchActivity(cookie, projectId, `?entity=tasks&entityId=${taskId}`);
    await toolText(key, 'update_task', { projectId, taskId, title: 'Same title' });
    const after = await fetchActivity(cookie, projectId, `?entity=tasks&entityId=${taskId}`);

    expect(before.length).toBe(1);
    expect(after.length).toBe(1);
  });

  it('records each entity created by plan_project', async () => {
    const cookie = await register('mcp-activity-plan@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const text = await toolText(key, 'plan_project', {
      projectId,
      brief: '- Ship v1 :: 2\n- Fix bugs :: 1\n# Milestone: M1 :: 0.1.0 :: 2026-09-01',
    });
    const parsed = JSON.parse(text);
    const taskIds = (parsed.createdTasks as { id: string }[]).map((t) => t.id);

    const items = await fetchActivity(cookie, projectId);
    const created = items.filter(
      (i) => i.entity === 'tasks' && taskIds.includes(i.entityId) && i.action === 'created',
    );
    expect(created.length).toBe(2);
  });
});