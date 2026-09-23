import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app, register, createTeam, createProject, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/modules/projects/domain/state.js';

const API = '/api/v1';

const baseLink = {
  id: '11111111-1111-4111-8111-111111111111',
  repo: 'org/repo',
  kind: 'pr',
  ref: '123',
  url: 'https://github.com/org/repo/pull/123',
  title: 'Fix login validation',
  status: 'open',
};

const baseTask = {
  id: '22222222-2222-4222-8222-222222222222',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  title: 'Fix login',
  status: 'todo',
  priority: 'high',
};

const baseIssue = {
  id: '33333333-3333-4333-8333-333333333333',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  title: 'Login broken',
  severity: 'high',
  status: 'open',
};

async function putAndGet(cookie: string, projectId: string, state: unknown) {
  const put = await request(app)
    .put(`${API}/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ state, version: 1 });
  expect(put.status).toBe(200);
  const get = await request(app)
    .get(`${API}/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(get.status).toBe(200);
  return get.body.state;
}

describe('github links (046/F1 zod-only, no state migration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('round-trips task githubLinks via PUT and GET state', async () => {
    const cookie = await register('gh-a@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);
    const state = { ...emptyState, tasks: [{ ...baseTask, githubLinks: [baseLink] }] };

    const got = await putAndGet(cookie, projectId, state);
    expect(got.tasks[0].githubLinks).toHaveLength(1);
    expect(got.tasks[0].githubLinks[0]).toMatchObject({
      repo: 'org/repo',
      kind: 'pr',
      ref: '123',
      status: 'open',
    });
  });

  it('treats missing githubLinks on legacy tasks as [] (backward-compat)', async () => {
    const cookie = await register('gh-b@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);

    const got = await putAndGet(cookie, projectId, { ...emptyState, tasks: [{ ...baseTask }] });
    expect(got.tasks[0].githubLinks ?? []).toEqual([]);
  });

  it('round-trips issue fixPr and strips unknown fields', async () => {
    const cookie = await register('gh-c@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);
    const state = {
      ...emptyState,
      issues: [{ ...baseIssue, fixPr: { ...baseLink }, bogusField: 'nope' }],
    };

    const got = await putAndGet(cookie, projectId, state);
    expect(got.issues[0].fixPr.repo).toBe('org/repo');
    expect(got.issues[0].bogusField).toBeUndefined();
  });

  it.each([
    { ...baseLink, repo: 'not-a-repo' },
    { ...baseLink, kind: 'tag' },
    { ...baseLink, ref: '' },
  ])('rejects invalid link %j with 400', async (link) => {
    const cookie = await register(`gh-bad-${randomUUID().slice(0, 8)}@gmail.com`);
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);

    const put = await request(app)
      .put(`${API}/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state: { ...emptyState, tasks: [{ ...baseTask, githubLinks: [link] }] }, version: 1 });
    expect(put.status).toBe(400);
  });

  it('round-trips githubLinks via granular task API (POST + PATCH)', async () => {
    const cookie = await register('gh-d@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);

    const created = await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: randomUUID(), title: 'T', status: 'todo', priority: 'high', githubLinks: [baseLink] });
    expect(created.status).toBe(201);
    expect(created.body.entity.githubLinks).toHaveLength(1);
    const taskId = created.body.entity.id as string;

    const patched = await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        githubLinks: [{ ...baseLink, id: randomUUID(), kind: 'branch', ref: 'feat/DEV-45-x', status: 'unknown' }],
      });
    expect(patched.status).toBe(200);
    expect(patched.body.entity.githubLinks[0].kind).toBe('branch');

    const badPatch = await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ githubLinks: [{ ...baseLink, repo: 'bad' }] });
    expect(badPatch.status).toBe(400);
  });

  it('round-trips issue fixPr via granular issue API', async () => {
    const cookie = await register('gh-e@gmail.com');
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, 'P', teamId);

    const created = await request(app)
      .post(`${API}/projects/${projectId}/issues`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: randomUUID(), title: 'I', severity: 'high', status: 'open', fixPr: baseLink });
    expect(created.status).toBe(201);
    expect(created.body.entity.fixPr.ref).toBe('123');
  });
});
