import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { app, register, createTeam, createProject, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import {
  upsertInstallation,
  connectProjectRepo,
  updateProjectAutomation,
} from '../src/modules/integrations/github/infrastructure/github-repository.js';
import { matchesIssueLabels } from '../src/modules/integrations/github/application/link-service.js';

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

type IssueRow = {
  id: string;
  title: string;
  status: string;
  severity: string;
  description: string;
  githubIssue: { owner: string; repo: string; number: number; url: string } | null;
};

async function getIssues(cookie: string, projectId: string): Promise<IssueRow[]> {
  const get = await request(app)
    .get(`${API}/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(get.status).toBe(200);
  return get.body.state.issues as IssueRow[];
}

async function setupProject(email: string, automation?: { onIssueOpened: string; issueLabels: string[] }) {
  const cookie = await register(email);
  const teamId = await createTeam(cookie);
  const projectId = await createProject(cookie, 'P', teamId);
  await upsertInstallation({ installationId: 717171, accountLogin: 'org', accountType: 'Organization' });
  await connectProjectRepo({ projectId, installationId: 717171, owner: 'org', repo: 'repo', connectedBy: null });
  await updateProjectAutomation(projectId, {
    onPrOpened: 'suggest',
    onPrMerged: 'suggest',
    onIssueOpened: automation?.onIssueOpened ?? 'auto',
    issueLabels: automation?.issueLabels ?? [],
  });
  return { cookie, projectId };
}

const issuePayload = (action: string, n = 7, extra: Record<string, unknown> = {}) => ({
  action,
  repository: { name: 'repo', owner: { login: 'org' } },
  issue: {
    number: n,
    title: 'Login broken',
    body: 'Steps to reproduce...',
    state: action === 'closed' ? 'closed' : 'open',
    labels: [{ name: 'bug' }],
    html_url: `https://github.com/org/repo/issues/${n}`,
    closed_at: action === 'closed' ? '2026-03-01T00:00:00.000Z' : null,
    ...extra,
  },
});

describe('github auto-issue (issues opened/closed -> DevHub issues)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects bad signature with 401', async () => {
    const res = await postWebhook('issues', 'iss-sig-bad', { action: 'opened' }, 'wrong-secret');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('GITHUB_BAD_SIGNATURE');
  });

  it('creates an issue on opened (auto, all labels)', async () => {
    const { cookie, projectId } = await setupProject('ghi-a@gmail.com');
    const res = await postWebhook('issues', 'iss-open-1', issuePayload('opened'));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processed');
    const rows = await getIssues(cookie, projectId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: 'Login broken',
      status: 'open',
      severity: 'medium',
      githubIssue: { owner: 'org', repo: 'repo', number: 7 },
    });
    expect(rows[0]!.description).toContain('Imported from org/repo#7');
  });

  it('is idempotent on duplicate opened (provenance, not delivery)', async () => {
    const { cookie, projectId } = await setupProject('ghi-b@gmail.com');
    await postWebhook('issues', 'iss-open-2a', issuePayload('opened'));
    const again = await postWebhook('issues', 'iss-open-2b', issuePayload('opened'));
    expect(again.status).toBe(200);
    const rows = await getIssues(cookie, projectId);
    expect(rows).toHaveLength(1);
  });

  it('resolves the linked issue on closed, ignores unknown numbers', async () => {
    const { cookie, projectId } = await setupProject('ghi-c@gmail.com');
    await postWebhook('issues', 'iss-c-open', issuePayload('opened'));
    const closed = await postWebhook('issues', 'iss-c-closed', issuePayload('closed'));
    expect(closed.status).toBe(200);
    let rows = await getIssues(cookie, projectId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('resolved');

    const ghost = await postWebhook('issues', 'iss-c-ghost', issuePayload('closed', 999));
    expect(ghost.status).toBe(200);
    rows = await getIssues(cookie, projectId);
    expect(rows).toHaveLength(1);
  });

  it('does nothing in suggest/off mode', async () => {
    const s = await setupProject('ghi-d@gmail.com', { onIssueOpened: 'suggest', issueLabels: [] });
    await postWebhook('issues', 'iss-d-suggest', issuePayload('opened'));
    expect(await getIssues(s.cookie, s.projectId)).toHaveLength(0);

    const o = await setupProject('ghi-e@gmail.com', { onIssueOpened: 'off', issueLabels: [] });
    await postWebhook('issues', 'iss-e-off', issuePayload('opened'));
    expect(await getIssues(o.cookie, o.projectId)).toHaveLength(0);
  });

  it('honors the label filter', async () => {
    const { cookie, projectId } = await setupProject('ghi-f@gmail.com', {
      onIssueOpened: 'auto',
      issueLabels: ['enhancement'],
    });
    await postWebhook('issues', 'iss-f-miss', issuePayload('opened'));
    expect(await getIssues(cookie, projectId)).toHaveLength(0);

    await postWebhook(
      'issues',
      'iss-f-hit',
      issuePayload('opened', 8, { labels: [{ name: 'Enhancement' }] }),
    );
    const rows = await getIssues(cookie, projectId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.githubIssue?.number).toBe(8);
  });

  it('ignores PRs-as-issues, other actions, and unmapped repos', async () => {
    const { cookie, projectId } = await setupProject('ghi-g@gmail.com');
    const pr = await postWebhook('issues', 'iss-g-pr', issuePayload('opened', 9, { pull_request: { url: 'x' } }));
    expect(pr.body.status).toBe('ignored');

    const edited = await postWebhook('issues', 'iss-g-edited', issuePayload('edited'));
    expect(edited.body.status).toBe('ignored');

    const other = await postWebhook(
      'issues',
      'iss-g-other',
      { action: 'opened', repository: { name: 'nope', owner: { login: 'org' } }, issue: { number: 1 } },
    );
    expect(other.body.status).toBe('ignored');
    expect(await getIssues(cookie, projectId)).toHaveLength(0);
  });

  it('matchesIssueLabels: empty=all, case-insensitive, allowlists', () => {
    expect(matchesIssueLabels([], ['bug'])).toBe(true);
    expect(matchesIssueLabels(['Bug'], ['bug'])).toBe(true);
    expect(matchesIssueLabels(['enhancement'], ['bug'])).toBe(false);
    expect(matchesIssueLabels(['a', 'b'], ['x', 'B'])).toBe(true);
  });
});
