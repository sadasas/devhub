import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createHmac, randomUUID } from 'node:crypto';
import { app, register, createTeam, createProject, inviteUser, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/modules/projects/domain/state.js';
import {
  upsertInstallation,
  connectProjectRepo,
  updateProjectAutomation,
  enqueueOutbox,
} from '../src/modules/integrations/github/infrastructure/github-repository.js';

vi.mock('../src/modules/integrations/github/application/install-service.js', async (importOriginal) => {
  const mod = await importOriginal<
    typeof import('../src/modules/integrations/github/application/install-service.js')
  >();
  return { ...mod, ensureInstallationToken: async () => 'test-installation-token' };
});

const WEBHOOK = '/webhooks/github';
const API = '/api/v1';
const SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET ?? '';

function sign(raw: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}`;
}

async function postWebhook(event: string, delivery: string, payload: unknown) {
  const raw = JSON.stringify(payload);
  return request(app)
    .post(WEBHOOK)
    .set('X-GitHub-Event', event)
    .set('X-GitHub-Delivery', delivery)
    .set('X-Hub-Signature-256', sign(raw))
    .set('Content-Type', 'application/json')
    .send(raw);
}

const TASK_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const baseTask = {
  id: TASK_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  title: 'Fix login',
  status: 'todo',
  priority: 'high',
};

type Link = { kind: string; ref: string; status: string; ciState?: string | null; reviewState?: string | null };

async function setupProject(email: string) {
  const cookie = await register(email);
  const teamId = await createTeam(cookie);
  const projectId = await createProject(cookie, 'P', teamId);
  const put = await request(app)
    .put(`${API}/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ state: { ...emptyState, tasks: [{ ...baseTask }] }, version: 1 });
  expect(put.status).toBe(200);
  await upsertInstallation({ installationId: 515151, accountLogin: 'org', accountType: 'Organization' });
  await connectProjectRepo({ projectId, installationId: 515151, owner: 'org', repo: 'repo', connectedBy: null });
  return { cookie, teamId, projectId };
}

async function getTask(cookie: string, projectId: string) {
  const get = await request(app)
    .get(`${API}/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(get.status).toBe(200);
  const task = (get.body.state.tasks as Array<{ id: string; status: string; completedAt?: string | null; githubLinks?: Link[] }>).find(
    (t) => t.id === TASK_ID,
  );
  expect(task).toBeDefined();
  return task!;
}

const prPayload = (action: string, extraPr: Record<string, unknown> = {}) => ({
  action,
  repository: { name: 'repo', owner: { login: 'org' } },
  pull_request: {
    number: 9,
    title: 'Fix login',
    body: `Fixes ${TASK_ID}`,
    html_url: 'https://github.com/org/repo/pull/9',
    draft: false,
    merged: false,
    state: 'open',
    head: { ref: 'feat/bbbbbbbb-fix-login' },
    ...extraPr,
  },
});

describe('github automation + intelligence (F4)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('records reviewState on approved review', async () => {
    const { cookie, projectId } = await setupProject('ghf4-a@gmail.com');
    await postWebhook('pull_request', 'f4-pr-1', prPayload('opened'));
    const res = await postWebhook('pull_request_review', 'f4-rev-1', {
      action: 'submitted',
      repository: { name: 'repo', owner: { login: 'org' } },
      review: { state: 'approved' },
      pull_request: {
        number: 9,
        title: 'Fix login',
        body: `Fixes ${TASK_ID}`,
        html_url: 'https://github.com/org/repo/pull/9',
        head: { ref: 'feat/bbbbbbbb-fix-login' },
      },
    });
    expect(res.body.status).toBe('processed');
    const task = await getTask(cookie, projectId);
    const pr = task.githubLinks?.find((l) => l.kind === 'pr' && l.ref === '9');
    expect(pr?.reviewState).toBe('approved');
  });

  it('ignores commented reviews (no reviewState change)', async () => {
    const { cookie, projectId } = await setupProject('ghf4-b@gmail.com');
    await postWebhook('pull_request', 'f4-pr-2', prPayload('opened'));
    await postWebhook('pull_request_review', 'f4-rev-2', {
      action: 'submitted',
      repository: { name: 'repo', owner: { login: 'org' } },
      review: { state: 'commented' },
      pull_request: {
        number: 9,
        title: 'Fix login',
        body: `Fixes ${TASK_ID}`,
        html_url: 'https://github.com/org/repo/pull/9',
        head: { ref: 'x' },
      },
    });
    const task = await getTask(cookie, projectId);
    const pr = task.githubLinks?.find((l) => l.kind === 'pr' && l.ref === '9');
    expect(pr?.reviewState ?? null).toBeNull();
  });

  it('records ciState fail on check_run completed failure', async () => {
    const { cookie, projectId } = await setupProject('ghf4-c@gmail.com');
    await postWebhook('pull_request', 'f4-pr-3', prPayload('opened'));
    const res = await postWebhook('check_run', 'f4-check-1', {
      repository: { name: 'repo', owner: { login: 'org' } },
      check_run: { status: 'completed', conclusion: 'failure', head_sha: 'deadbeef', pull_requests: [{ number: 9 }] },
    });
    expect(res.body.status).toBe('processed');
    const task = await getTask(cookie, projectId);
    expect(task.githubLinks?.find((l) => l.kind === 'pr' && l.ref === '9')?.ciState).toBe('fail');
  });

  it('ignores non-completed check runs', async () => {
    const { cookie, projectId } = await setupProject('ghf4-d@gmail.com');
    await postWebhook('pull_request', 'f4-pr-4', prPayload('opened'));
    const res = await postWebhook('check_run', 'f4-check-2', {
      repository: { name: 'repo', owner: { login: 'org' } },
      check_run: { status: 'in_progress', conclusion: null, head_sha: 'x', pull_requests: [{ number: 9 }] },
    });
    expect(res.body.detail).toBe('not-completed');
    const task = await getTask(cookie, projectId);
    expect(task.githubLinks?.find((l) => l.kind === 'pr')?.ciState ?? null).toBeNull();
  });

  it('auto mode moves todo->inProgress on opened and ->done on merged', async () => {
    const { cookie, projectId } = await setupProject('ghf4-e@gmail.com');
    await updateProjectAutomation(projectId, { onPrOpened: 'auto', onPrMerged: 'auto' });
    await postWebhook('pull_request', 'f4-pr-5', prPayload('opened'));
    let task = await getTask(cookie, projectId);
    expect(task.status).toBe('inProgress');

    await postWebhook('pull_request', 'f4-pr-6', prPayload('closed', { merged: true, state: 'closed' }));
    task = await getTask(cookie, projectId);
    expect(task.status).toBe('done');
    expect(task.completedAt).toBeDefined();
  });

  it('suggest mode (default) never moves status', async () => {
    const { cookie, projectId } = await setupProject('ghf4-f@gmail.com');
    await postWebhook('pull_request', 'f4-pr-7', prPayload('opened'));
    await postWebhook('pull_request', 'f4-pr-8', prPayload('closed', { merged: true, state: 'closed' }));
    const task = await getTask(cookie, projectId);
    expect(task.status).toBe('todo');
    expect(task.githubLinks?.find((l) => l.kind === 'pr')?.status).toBe('merged');
  });

  it('posts linkback comment once on PR opened with new link', async () => {
    const fetchCalls: Array<{ url: string; body: string }> = [];
    vi.stubGlobal(
      'fetch',
      async (url: string, init?: { body?: string }) => {
        fetchCalls.push({ url: String(url), body: String(init?.body ?? '') });
        return { status: 201, text: async () => '{}' };
      },
    );
    await setupProject('ghf4-g@gmail.com');
    await postWebhook('pull_request', 'f4-pr-9', prPayload('opened'));
    const comments = fetchCalls.filter((c) => c.url.endsWith('/issues/9/comments'));
    expect(comments).toHaveLength(1);
    expect(comments[0]?.body).toContain('Linked to DevHub');
  });

  it('drains outbox: failed apply retried via endpoint (admin only)', async () => {
    const ownerCookie = await register('ghf4-h@gmail.com');
    const viewerCookie = await register('ghf4-i@gmail.com');
    const teamId = await createTeam(ownerCookie);
    await inviteUser(ownerCookie, viewerCookie, teamId, 'viewer');
    const projectId = await createProject(ownerCookie, 'P', teamId);
    const put = await request(app)
      .put(`${API}/projects/${projectId}/state`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state: { ...emptyState, tasks: [{ ...baseTask }] }, version: 1 });
    expect(put.status).toBe(200);
    await upsertInstallation({ installationId: 515152, accountLogin: 'org', accountType: 'Organization' });
    await connectProjectRepo({ projectId, installationId: 515152, owner: 'org', repo: 'repo', connectedBy: null });

    await enqueueOutbox({
      projectId,
      taskId: null,
      op: 'link',
      payload: {
        event: 'push',
        payload: {
          ref: 'refs/heads/main',
          repository: { name: 'repo', owner: { login: 'org' } },
          commits: [{ id: 'ff00ff', message: `fix ${TASK_ID}`, url: '' }],
        },
      },
    });

    const forbidden = await request(app)
      .post(`${API}/integrations/github/outbox/drain?projectId=${projectId}`)
      .set('Cookie', viewerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(forbidden.status).toBe(403);

    const drained = await request(app)
      .post(`${API}/integrations/github/outbox/drain?projectId=${projectId}`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(drained.status).toBe(200);
    expect(drained.body.succeeded).toBe(1);

    const task = await getTask(ownerCookie, projectId);
    expect(task.githubLinks?.some((l) => l.kind === 'commit' && l.ref === 'ff00ff')).toBe(true);
  });

  it('rejects invalid automation body with 400', async () => {
    const { cookie, projectId } = await setupProject(`ghf4-j-${randomUUID().slice(0, 8)}@gmail.com`);
    const res = await request(app)
      .patch(`${API}/integrations/github/repos`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId, automation: { onPrOpened: 'sometimes', onPrMerged: 'suggest' } });
    expect(res.status).toBe(400);
  });
});
