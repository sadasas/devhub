import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { TestAgent } from 'supertest';
import {
  app,
  createKey,
  createProject,
  getFirstTeamId,
  inviteUser,
  register,
  uniqueIp,
} from './helpers.js';
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

async function readTestCases(cookie: string, projectId: string) {
  const res = await request(app)
    .get(`/api/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  return (res.body.state.testCases ?? []) as Array<{
    id: string;
    name: string;
    status: string;
    taskId: string | null;
    steps: string;
    expected: string;
  }>;
}

describe('MCP test case tools', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists add_test_case and update_test_case', async () => {
    const cookie = await register('tclist@test.dev');
    const key = await createKey(cookie);
    const res = await mcpCall(key, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    const tools = (res.body.result?.tools as { name: string }[] | undefined) ?? [];
    expect(tools.some((t) => t.name === 'add_test_case')).toBe(true);
    expect(tools.some((t) => t.name === 'update_test_case')).toBe(true);
  });

  it('adds a test case linked to a task', async () => {
    const cookie = await register('tcadd@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const task = await toolCall(key, 'create_task', { projectId, title: 'Fix login expiry' });
    const taskText = task.body.result?.content?.[0]?.text ?? '';
    const taskId = JSON.parse(taskText).id as string;

    const res = await toolCall(key, 'add_test_case', {
      projectId,
      name: 'Login survives 25h session expiry',
      taskId,
      steps: '1. Log in\n2. Wait 25 hours\n3. Refresh',
      expected: 'Session is refreshed silently',
    });
    expect(res.status).toBe(200);
    const text = res.body.result?.content?.[0]?.text ?? '';
    expect(text).toContain('Login survives 25h session expiry');
    expect(text).toContain('"status": "pending"');
    expect(text).toContain(`"taskId": "${taskId}"`);

    const testCases = await readTestCases(cookie, projectId);
    expect(testCases).toHaveLength(1);
    expect(testCases[0]).toMatchObject({
      name: 'Login survives 25h session expiry',
      taskId,
      steps: '1. Log in\n2. Wait 25 hours\n3. Refresh',
    });
  });

  it('adds an issue carrying a description for test-case linkage', async () => {
    const cookie = await register('tcissue@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const issue = await toolCall(key, 'add_issue', {
      projectId,
      title: 'Board breaks on mobile',
      severity: 'high',
      description: 'Kanban columns overlap on narrow screens.',
      reproduction: '1. Open board\n2. Shrink window',
    });
    expect(issue.status).toBe(200);
    const issueText = issue.body.result?.content?.[0]?.text ?? '';
    expect(issueText).toContain('Board breaks on mobile');

    const state = await request(app)
      .get(`/api/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(state.body.state.issues[0]).toMatchObject({
      title: 'Board breaks on mobile',
      description: 'Kanban columns overlap on narrow screens.',
      reproduction: '1. Open board\n2. Shrink window',
    });
  });

  it('updates a test case status and links', async () => {
    const cookie = await register('tcupd@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const created = await toolCall(key, 'add_test_case', { projectId, name: 'Export works' });
    const id = JSON.parse(created.body.result?.content?.[0]?.text ?? '').id as string;

    const up = await toolCall(key, 'update_test_case', {
      projectId,
      testCaseId: id,
      status: 'pass',
      expected: 'JSON file downloads with valid meta',
    });
    expect(up.status).toBe(200);
    expect(up.body.result?.content?.[0]?.text).toContain('"status": "pass"');

    const testCases = await readTestCases(cookie, projectId);
    expect(testCases[0]).toMatchObject({
      id,
      name: 'Export works',
      status: 'pass',
      expected: 'JSON file downloads with valid meta',
    });
  });

  it('rejects update of an unknown test case', async () => {
    const cookie = await register('tcmiss@test.dev');
    const projectId = await createProject(cookie);
    const key = await createKey(cookie);

    const res = await toolCall(key, 'update_test_case', {
      projectId,
      testCaseId: '00000000-0000-4000-8000-000000000000',
      status: 'pass',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('Test case not found');
  });

  it('viewers cannot add test cases', async () => {
    const owner = await register('tcowner@test.dev');
    const teamId = await getFirstTeamId(owner);
    const projectId = await createProject(owner, 'Shared', teamId);
    const viewer = await register('tcviewer@test.dev');
    await inviteUser(owner, viewer, teamId, 'viewer');
    const viewerKey = await createKey(viewer);

    const res = await toolCall(viewerKey, 'add_test_case', {
      projectId,
      name: 'Should be rejected',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('No write access');
  });
});