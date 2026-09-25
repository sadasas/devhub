import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app, register, createTeam, createProject, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import {
  markInstallationStatus,
  upsertInstallation,
} from '../src/modules/integrations/github/infrastructure/github-repository.js';

/**
 * Multi-akun GitHub (project A = instalasi X, project B = instalasi Y):
 * - POST /repos memverifikasi owner/repo milik instalasi (403 bila silang).
 * - GET /installations hanya yang status 'connected'.
 * App GitHub dimock (env test kosong): token disematkan id instalasi agar
 * listInstallationRepos mengembalikan repo per instalasi — alur real
 * install-service (token cache sealed) tetap terpakai.
 */

const REPOS: Record<string, Array<{ owner: string; repo: string; fullName: string; isPrivate: boolean }>> = {
  '77001': [{ owner: 'org-lama', repo: 'web', fullName: 'org-lama/web', isPrivate: false }],
  '77002': [{ owner: 'akun-baru', repo: 'app', fullName: 'akun-baru/app', isPrivate: true }],
};

vi.mock('../src/modules/integrations/github/infrastructure/github-app.js', async (importOriginal) => {
  const mod = await importOriginal<
    typeof import('../src/modules/integrations/github/infrastructure/github-app.js')
  >();
  return {
    ...mod,
    isGithubAppConfigured: () => true,
    createInstallationToken: async (installationId: number) => ({
      token: `ghs_mock_${installationId}`,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }),
    listInstallationRepos: async (token: string) => {
      const id = token.replace('ghs_mock_', '');
      return REPOS[id] ?? [];
    },
  };
});

const API = '/api/v1/integrations/github';

async function setupProject(email: string, name: string) {
  const cookie = await register(email);
  const teamId = await createTeam(cookie);
  const projectId = await createProject(cookie, name, teamId);
  return { cookie, projectId };
}

describe('github multi-account connect', () => {
  beforeEach(async () => {
    await resetDb();
    await upsertInstallation({ installationId: 77001, accountLogin: 'org-lama', accountType: 'Organization' });
    await upsertInstallation({ installationId: 77002, accountLogin: 'akun-baru', accountType: 'User' });
  });

  it('connects project A and B to different installations (201 + 201)', async () => {
    const a = await setupProject('multi-a@gmail.com', 'PA');
    const b = await setupProject('multi-b@gmail.com', 'PB');

    const ra = await request(app)
      .post(`${API}/repos`)
      .set('Cookie', a.cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId: a.projectId, installationId: 77001, owner: 'org-lama', repo: 'web' });
    expect(ra.status).toBe(201);

    const rb = await request(app)
      .post(`${API}/repos`)
      .set('Cookie', b.cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId: b.projectId, installationId: 77002, owner: 'akun-baru', repo: 'app' });
    expect(rb.status).toBe(201);
    expect(rb.body.mapping).toMatchObject({ owner: 'akun-baru', repo: 'app', installationId: 77002 });
  });

  it('rejects cross-installation repo with 403 and stores nothing', async () => {
    const b = await setupProject('multi-c@gmail.com', 'PB');
    const res = await request(app)
      .post(`${API}/repos`)
      .set('Cookie', b.cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId: b.projectId, installationId: 77002, owner: 'org-lama', repo: 'web' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('REPO_NOT_IN_INSTALLATION');

    const status = await request(app)
      .get(`${API}/status?projectId=${b.projectId}`)
      .set('Cookie', b.cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(status.body.connected).toBe(false);
  });

  it('matches owner/repo case-insensitively', async () => {
    const a = await setupProject('multi-d@gmail.com', 'PA');
    const res = await request(app)
      .post(`${API}/repos`)
      .set('Cookie', a.cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId: a.projectId, installationId: 77001, owner: 'ORG-LAMA', repo: 'Web' });
    expect(res.status).toBe(201);
  });
});

describe('github installations visibility', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists only connected installations', async () => {
    const cookie = await register('multi-e@gmail.com');
    await upsertInstallation({ installationId: 77001, accountLogin: 'org-lama', accountType: 'Organization' });
    await upsertInstallation({ installationId: 77002, accountLogin: 'akun-beku', accountType: 'Organization' });
    await upsertInstallation({ installationId: 77003, accountLogin: 'akun-hapus', accountType: 'User' });
    await markInstallationStatus(77002, 'suspended', 'App suspended on GitHub');
    await markInstallationStatus(77003, 'removed', 'App uninstalled on GitHub');

    const res = await request(app)
      .get(`${API}/installations`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.installations).toEqual([
      { installationId: 77001, accountLogin: 'org-lama', accountType: 'Organization', status: 'connected' },
    ]);
  });
});
