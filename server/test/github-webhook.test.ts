import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createHmac, randomUUID } from 'node:crypto';
import { app, register, createTeam, createProject, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/modules/projects/domain/state.js';
import { upsertInstallation } from '../src/modules/integrations/github/infrastructure/github-repository.js';
import { connectProjectRepo } from '../src/modules/integrations/github/infrastructure/github-repository.js';

const WEBHOOK = '/webhooks/github';
const API = '/api/v1';
const SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET ?? '';

function sign(raw: string, secret: string = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
}

async function postWebhook(event: string, delivery: string, payload: unknown, secret: string = SECRET) {
  const raw = JSON.stringify(payload);
  return request(app)
    .post(WEBHOOK)
    .set('X-GitHub-Event', event)
    .set('X-GitHub-Delivery', delivery)
    .set('X-Hub-Signature-256', sign(raw, secret))
    .set('Content-Type', 'application/json')
    .send(raw);
}

async function getTaskLinks(cookie: string, projectId: string, taskId: string) {
  const get = await request(app)
    .get(`${API}/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(get.status).toBe(200);
  const task = (get.body.state.tasks as Array<{ id: string; githubLinks?: unknown[] }>).find(
    (t) => t.id === taskId,
  );
  return (task?.githubLinks ?? []) as Array<{ kind: string; ref: string; status: string }>;
}

const TASK_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const baseTask = {
  id: TASK_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  title: 'Fix login',
  status: 'todo',
  priority: 'high',
};

async function setupProject(email: string) {
  const cookie = await register(email);
  const teamId = await createTeam(cookie);
  const projectId = await createProject(cookie, 'P', teamId);
  await request(app)
    .put(`${API}/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ state: { ...emptyState, tasks: [{ ...baseTask }] }, version: 1 });
  await upsertInstallation({ installationId: 424242, accountLogin: 'org', accountType: 'Organization' });
  await connectProjectRepo({ projectId, installationId: 424242, owner: 'org', repo: 'repo', connectedBy: null });
  return { cookie, projectId };
}

const pushPayload = (message: string) => ({
  ref: 'refs/heads/feat/aaaaaaaa-fix-login',
  repository: { name: 'repo', owner: { login: 'org' } },
  commits: [{ id: 'abc123def456', message, url: 'https://github.com/org/repo/commit/abc123def456' }],
});

describe('github webhook (F3)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects bad signature with 401', async () => {
    const res = await postWebhook('ping', 'sig-bad', { zen: 'hi' }, 'wrong-secret');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('GITHUB_BAD_SIGNATURE');
  });

  it('rejects missing event headers with 400', async () => {
    const raw = JSON.stringify({ zen: 'hi' });
    const res = await request(app)
      .post(WEBHOOK)
      .set('X-Hub-Signature-256', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(400);
  });

  it('answers ping and dedupes redelivery', async () => {
    const first = await postWebhook('ping', 'ping-1', { zen: 'hi' });
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('pong');
    const second = await postWebhook('ping', 'ping-1', { zen: 'hi' });
    expect(second.body.status).toBe('deduped');
  });

  it('links commit to task via uuid in message (push)', async () => {
    const { cookie, projectId } = await setupProject('ghw-a@gmail.com');
    const res = await postWebhook('push', 'push-1', pushPayload(`fix ${TASK_ID} ok`));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processed');

    const links = await getTaskLinks(cookie, projectId, TASK_ID);
    expect(links.some((l) => l.kind === 'commit' && l.ref === 'abc123def456')).toBe(true);
    expect(links.some((l) => l.kind === 'branch' && l.ref === 'feat/aaaaaaaa-fix-login')).toBe(true);
  });

  it('does not duplicate links on redelivery (same delivery id)', async () => {
    const { cookie, projectId } = await setupProject('ghw-b@gmail.com');
    await postWebhook('push', 'push-dup', pushPayload(`fix ${TASK_ID} ok`));
    const again = await postWebhook('push', 'push-dup', pushPayload(`fix ${TASK_ID} ok`));
    expect(again.body.status).toBe('deduped');

    const links = await getTaskLinks(cookie, projectId, TASK_ID);
    expect(links.filter((l) => l.kind === 'commit')).toHaveLength(1);
  });

  it('ignores push to unmapped repo', async () => {
    await setupProject('ghw-c@gmail.com');
    const res = await postWebhook('push', 'push-nomap', {
      ref: 'refs/heads/main',
      repository: { name: 'other', owner: { login: 'org' } },
      commits: [{ id: 'x', message: `fix ${TASK_ID}`, url: '' }],
    });
    expect(res.body.status).toBe('ignored');
    expect(res.body.detail).toBe('no-mapping');
  });

  it('links PR on opened and updates status on merged', async () => {
    const { cookie, projectId } = await setupProject('ghw-d@gmail.com');
    const pr = {
      repository: { name: 'repo', owner: { login: 'org' } },
      action: 'opened',
      pull_request: {
        number: 7,
        title: 'Fix login',
        body: `Fixes ${TASK_ID}`,
        html_url: 'https://github.com/org/repo/pull/7',
        draft: false,
        merged: false,
        state: 'open',
        head: { ref: 'feat/aaaaaaaa-fix-login' },
      },
    };
    const opened = await postWebhook('pull_request', 'pr-1', pr);
    expect(opened.body.status).toBe('processed');
    let links = await getTaskLinks(cookie, projectId, TASK_ID);
    expect(links.some((l) => l.kind === 'pr' && l.ref === '7' && l.status === 'open')).toBe(true);

    const merged = await postWebhook('pull_request', 'pr-2', {
      ...pr,
      action: 'closed',
      pull_request: { ...pr.pull_request, merged: true, state: 'closed' },
    });
    expect(merged.body.status).toBe('processed');
    links = await getTaskLinks(cookie, projectId, TASK_ID);
    const prLinks = links.filter((l) => l.kind === 'pr' && l.ref === '7');
    expect(prLinks).toHaveLength(1);
    expect(prLinks[0]?.status).toBe('merged');
  });

  it('upserts installation on installation.created', async () => {
    const res = await postWebhook('installation', 'inst-1', {
      action: 'created',
      installation: { id: 777001, account: { login: 'acme', type: 'Organization' } },
    });
    expect(res.body.status).toBe('processed');
  });

  it('ignores unknown events', async () => {
    const res = await postWebhook('star', 'star-1', { action: 'created' });
    expect(res.body.status).toBe('ignored');
  });
});
