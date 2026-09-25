import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import request from 'supertest';
import type { TestAgent } from 'supertest';
import { app, createKey, createProject, createTeam, register, inviteUser, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { upsertInstallation, connectProjectRepo } from '../src/modules/integrations/github/infrastructure/github-repository.js';

vi.mock('../src/modules/integrations/github/application/install-service.js', async (importOriginal) => {
  const mod = await importOriginal<
    typeof import('../src/modules/integrations/github/application/install-service.js')
  >();
  return {
    ...mod,
    assertGithubConfigured: () => {},
    ensureInstallationToken: async () => 'test-installation-token',
  };
});

const API = '/api/v1';

function mcpCall(key: string, body: unknown): TestAgent {
  const req = request(app)
    .post('/mcp')
    .set('Accept', 'application/json, text/event-stream')
    .set('X-Forwarded-For', uniqueIp());
  if (key) req.set('Authorization', `Bearer ${key}`);
  return req.send(body);
}

async function toolCall(key: string, name: string, args: Record<string, unknown>) {
  const res = await mcpCall(key, {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name, arguments: args },
  });
  return res;
}

function stubIssues(items: unknown[]) {
  vi.stubGlobal(
    'fetch',
    async (url: string) => {
      if (String(url).includes('/repos/org/repo/issues')) {
        return { status: 200, text: async () => JSON.stringify(items) };
      }
      throw new Error(`unexpected fetch: ${url}`);
    },
  );
}

const ISSUES = [
  {
    number: 1,
    title: 'Login broken',
    body: 'Steps to reproduce...',
    state: 'open',
    labels: [{ name: 'bug' }],
    html_url: 'https://github.com/org/repo/issues/1',
    closed_at: null,
  },
  {
    number: 2,
    title: 'Old bug',
    body: 'fixed long ago',
    state: 'closed',
    labels: [],
    html_url: 'https://github.com/org/repo/issues/2',
    closed_at: '2026-02-01T00:00:00.000Z',
  },
  {
    number: 3,
    title: 'A PR, not an issue',
    body: '',
    state: 'open',
    labels: [],
    html_url: 'https://github.com/org/repo/pull/3',
    closed_at: null,
    pull_request: { url: 'https://api.github.com/repos/org/repo/pulls/3' },
  },
];

async function setupMapped(email: string) {
  const cookie = await register(email);
  const teamId = await createTeam(cookie);
  const projectId = await createProject(cookie, 'P', teamId);
  await upsertInstallation({ installationId: 616161, accountLogin: 'org', accountType: 'Organization' });
  await connectProjectRepo({ projectId, installationId: 616161, owner: 'org', repo: 'repo', connectedBy: null });
  return { cookie, teamId, projectId };
}

describe('github import issues + MCP links (F6, target issues)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('imports issues as DevHub issues, skips PRs, and is idempotent', async () => {
    const { cookie, projectId } = await setupMapped('ghf6-a@gmail.com');
    stubIssues(ISSUES);

    const first = await request(app)
      .post(`${API}/integrations/github/import`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId });
    expect(first.status).toBe(201);
    expect(first.body.imported).toBe(2);
    expect(first.body.skipped).toBe(1);
    expect(first.body.issueIds).toHaveLength(2);

    const state = (
      await request(app).get(`${API}/projects/${projectId}/state`).set('Cookie', cookie).set('X-Forwarded-For', uniqueIp())
    ).body.state;
    type Row = {
      title: string;
      status: string;
      severity: string;
      description: string;
      githubIssue: { owner: string; repo: string; number: number } | null;
    };
    const rows = state.issues as Row[];
    const titles = rows.map((t) => t.title);
    expect(titles).toContain('Login broken');
    const done = rows.find((t) => t.title === 'Old bug');
    expect(done?.status).toBe('resolved');
    const open = rows.find((t) => t.title === 'Login broken');
    expect(open?.status).toBe('open');
    expect(open?.severity).toBe('medium');
    expect(open?.githubIssue).toMatchObject({ owner: 'org', repo: 'repo', number: 1 });
    expect(open?.description).toContain('Imported from org/repo#1');
    expect(open?.description).toContain('Labels: bug');

    const second = await request(app)
      .post(`${API}/integrations/github/import`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId });
    expect(second.body.imported).toBe(0);
    expect(second.body.skipped).toBe(3);
  });

  it('returns 403 for viewer and 400 when unmapped', async () => {
    const ownerCookie = await register('ghf6-b@gmail.com');
    const viewerCookie = await register('ghf6-c@gmail.com');
    const teamId = await createTeam(ownerCookie);
    await inviteUser(ownerCookie, viewerCookie, teamId, 'viewer');
    const projectId = await createProject(ownerCookie, 'P', teamId);

    stubIssues([]);
    const forbidden = await request(app)
      .post(`${API}/integrations/github/import`)
      .set('Cookie', viewerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId });
    expect(forbidden.status).toBe(403);

    const unmapped = await request(app)
      .post(`${API}/integrations/github/import`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId });
    expect(unmapped.status).toBe(400);
  });

  it('creates and replaces task links via MCP', async () => {
    const cookie = await register('ghf6-d@gmail.com');
    const key = await createKey(cookie);
    const projectId = await createProject(cookie);

    const link = {
      id: '44444444-4444-4444-8444-444444444444',
      repo: 'org/repo',
      kind: 'pr',
      ref: '11',
      url: 'https://github.com/org/repo/pull/11',
      title: 'Fix it',
      status: 'open',
    };
    await toolCall(key, 'create_task', { projectId, title: 'MCP links', githubLinks: [link] });
    let state = (
      await request(app).get(`${API}/projects/${projectId}/state`).set('Cookie', cookie).set('X-Forwarded-For', uniqueIp())
    ).body.state;
    expect(state.tasks[0].githubLinks).toHaveLength(1);

    const taskId = state.tasks[0].id as string;
    await toolCall(key, 'update_task', { projectId, taskId, githubLinks: [] });
    state = (
      await request(app).get(`${API}/projects/${projectId}/state`).set('Cookie', cookie).set('X-Forwarded-For', uniqueIp())
    ).body.state;
    expect(state.tasks[0].githubLinks).toHaveLength(0);
  });
});
