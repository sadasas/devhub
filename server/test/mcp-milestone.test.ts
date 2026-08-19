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

async function readMilestones(cookie: string, projectId: string) {
  const res = await request(app)
    .get(`/api/v1/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  return res.body.state.milestones as Array<{
    id: string;
    name: string;
    status: string;
    version: string | null;
    targetDate: string | null;
  }>;
}

describe('MCP add_milestone', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a milestone with default status planned', async () => {
    const cookie = await register('mcpmilestone@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'add_milestone', {
      projectId,
      name: 'M26: Profile Redesign',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.content?.[0]?.text).toContain('M26: Profile Redesign');
    expect(res.body.result?.content?.[0]?.text).toContain('planned');

    const milestones = await readMilestones(cookie, projectId);
    expect(milestones).toHaveLength(1);
    expect(milestones[0]!.name).toBe('M26: Profile Redesign');
    expect(milestones[0]!.status).toBe('planned');
  });

  it('creates a milestone with version, target date and changelog', async () => {
    const cookie = await register('mcpmilestone2@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'add_milestone', {
      projectId,
      name: 'M26: Profile Redesign',
      version: 'v0.17.0',
      targetDate: '2026-08-25',
      status: 'inProgress',
      changelog: 'Redesign halaman profile',
    });
    expect(res.status).toBe(200);

    const milestones = await readMilestones(cookie, projectId);
    expect(milestones[0]!.version).toBe('v0.17.0');
    expect(milestones[0]!.targetDate).toBe('2026-08-25');
    expect(milestones[0]!.status).toBe('inProgress');
  });

  it('rejects an empty name', async () => {
    const cookie = await register('mcpmilestone3@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const res = await toolCall(key, 'add_milestone', {
      projectId,
      name: '',
    });
    expect(res.status).toBe(200);
    expect(res.body.result?.isError).toBe(true);
    expect(res.body.result?.content?.[0]?.text).toContain('-32602');
    expect(res.body.result?.content?.[0]?.text).toMatch(/name/i);

    const milestones = await readMilestones(cookie, projectId);
    expect(milestones).toHaveLength(0);
  });

  it('round-trips add_milestone then update_milestone', async () => {
    const cookie = await register('mcpmilestone4@test.dev');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    await toolCall(key, 'add_milestone', { projectId, name: 'M26: Profile Redesign' });
    let milestones = await readMilestones(cookie, projectId);
    const milestoneId = milestones[0]!.id;

    const res = await toolCall(key, 'update_milestone', {
      projectId,
      milestoneId,
      status: 'released',
      changelog: 'Shipped',
    });
    expect(res.status).toBe(200);

    milestones = await readMilestones(cookie, projectId);
    expect(milestones[0]!.status).toBe('released');
  });
});
