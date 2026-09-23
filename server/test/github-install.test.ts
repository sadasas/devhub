import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app, register, createTeam, createProject, inviteUser, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import {
  extractTaskKeys,
  formatBranchName,
  formatPrBody,
} from '../src/modules/integrations/github/domain/github.js';
import { sealToken, openToken } from '../src/modules/integrations/github/infrastructure/token-vault.js';
import {
  computeNextRetry,
  connectProjectRepo,
  disconnectProjectRepo,
  findProjectsByRepo,
  getProjectRepo,
  insertWebhookDelivery,
  upsertInstallation,
} from '../src/modules/integrations/github/infrastructure/github-repository.js';

const API = '/api/v1/integrations/github';

describe('github domain (pure, no DB)', () => {
  it('extracts full UUIDs', () => {
    const id = randomUUID();
    expect(extractTaskKeys(`fix ${id} asap`)).toEqual([{ kind: 'uuid', value: id }]);
  });

  it('extracts DEV- keys case-insensitively and dedupes short-hex overlap', () => {
    const got = extractTaskKeys('PR for DEV-123E4567 and 123e4567 again');
    expect(got).toEqual([{ kind: 'dev', value: '123e4567' }]);
  });

  it('extracts bare 8-hex short ids from branch names', () => {
    const got = extractTaskKeys('feat/123e4567-fix-login');
    expect(got).toEqual([{ kind: 'short', value: '123e4567' }]);
  });

  it('returns [] for empty text and ignores 7/9-hex runs', () => {
    expect(extractTaskKeys('')).toEqual([]);
    expect(extractTaskKeys('fix abc1234 and 123e456789 now')).toEqual([]);
  });

  it('formats branch names deterministically', () => {
    expect(formatBranchName('123e4567-e89b-12d3-a456-426614174000', 'Fix login validation!')).toBe(
      'feat/123e4567-fix-login-validation',
    );
    expect(formatBranchName('123e4567-e89b-12d3-a456-426614174000', '')).toBe('feat/123e4567');
  });

  it('formats PR body with Fixes trailer', () => {
    const id = randomUUID();
    expect(formatPrBody(id, 'Fix login')).toBe(`Fix login\n\nFixes ${id}`);
  });

  it('seals and opens tokens (round-trip)', () => {
    const blob = sealToken('ghs_secret-token');
    expect(blob).not.toContain('ghs_secret-token');
    expect(openToken(blob)).toBe('ghs_secret-token');
  });

  it('computes outbox backoff 1m/5m/30m', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    expect(computeNextRetry(1, now).toISOString()).toBe('2026-01-01T00:01:00.000Z');
    expect(computeNextRetry(2, now).toISOString()).toBe('2026-01-01T00:05:00.000Z');
    expect(computeNextRetry(9, now).toISOString()).toBe('2026-01-01T00:30:00.000Z');
  });
});

describe('github install routes (F2)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`${API}/status?projectId=${randomUUID()}`);
    expect(res.status).toBe(401);
  });

  it('returns 503 GITHUB_NOT_CONFIGURED when App env is empty', async () => {
    const cookie = await register('ghf2-a@gmail.com');
    const res = await request(app)
      .get(`${API}/install-url`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('GITHUB_NOT_CONFIGURED');
  });

  it('rejects invalid connect body with 400 before touching project', async () => {
    const cookie = await register('ghf2-b@gmail.com');
    const res = await request(app)
      .post(`${API}/repos`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId: 'not-a-uuid', installationId: -1, owner: 'a/b', repo: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown project with valid body', async () => {
    const cookie = await register('ghf2-c@gmail.com');
    const res = await request(app)
      .post(`${API}/repos`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId: randomUUID(), installationId: 123, owner: 'org', repo: 'repo' });
    expect(res.status).toBe(404);
  });

  it('returns 403 for viewer connecting a repo (admin only)', async () => {
    const ownerCookie = await register('ghf2-d@gmail.com');
    const viewerCookie = await register('ghf2-e@gmail.com');
    const teamId = await createTeam(ownerCookie);
    await inviteUser(ownerCookie, viewerCookie, teamId, 'viewer');
    const projectId = await createProject(ownerCookie, 'P', teamId);
    const res = await request(app)
      .post(`${API}/repos`)
      .set('Cookie', viewerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId, installationId: 123, owner: 'org', repo: 'repo' });
    expect(res.status).toBe(403);
  });

  it('reports disconnected status and 404 on delete without mapping', async () => {
    const cookie = await register('ghf2-f@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);

    const status = await request(app)
      .get(`${API}/status?projectId=${projectId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(status.status).toBe(200);
    expect(status.body.connected).toBe(false);

    const del = await request(app)
      .delete(`${API}/repos?projectId=${projectId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(del.status).toBe(404);
  });

  it('connect/status/disconnect round-trips at repository level', async () => {
    const cookie = await register('ghf2-g@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);

    await upsertInstallation({ installationId: 999001, accountLogin: 'org', accountType: 'Organization' });
    await connectProjectRepo({ projectId, installationId: 999001, owner: 'org', repo: 'repo', connectedBy: null });
    const got = await getProjectRepo(projectId);
    expect(got).toMatchObject({ owner: 'org', repo: 'repo', installationId: 999001 });
    expect(got?.automation).toEqual({ onPrOpened: 'suggest', onPrMerged: 'suggest' });

    // 1 repo boleh dipetakan ke banyak project (monorepo)
    const projectId2 = await createProject(cookie, 'P2', teamId);
    await connectProjectRepo({ projectId: projectId2, installationId: 999001, owner: 'org', repo: 'repo', connectedBy: null });
    expect(await findProjectsByRepo('org', 'repo')).toHaveLength(2);

    expect(await disconnectProjectRepo(projectId)).toBe(true);
    expect(await getProjectRepo(projectId)).toBeNull();
  });

  it('dedupes webhook deliveries by delivery id', async () => {
    expect(
      await insertWebhookDelivery({ deliveryId: 'd-1', event: 'push', action: null, repo: 'org/repo', projectId: null }),
    ).toBe(true);
    expect(
      await insertWebhookDelivery({ deliveryId: 'd-1', event: 'push', action: null, repo: 'org/repo', projectId: null }),
    ).toBe(false);
  });
});
