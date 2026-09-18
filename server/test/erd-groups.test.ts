import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createProject, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/modules/projects/domain/state.js';

describe('erdGroups (areas, zod-only entity, no DB migration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  const baseGroup = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Billing',
    color: '#e8b955',
    tableIds: [],
  };

  async function putAndGet(cookie: string, projectId: string, state: unknown) {
    const put = await request(app)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state, version: 1 });
    expect(put.status).toBe(200);
    const get = await request(app)
      .get(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(get.status).toBe(200);
    return get.body.state;
  }

  it('round-trips erdGroups via PUT and GET state', async () => {
    const cookie = await register('erdgroups@test.dev');
    const projectId = await createProject(cookie);
    const got = await putAndGet(cookie, projectId, { ...emptyState, erdGroups: [baseGroup] });
    expect(got.erdGroups).toHaveLength(1);
    expect(got.erdGroups[0]).toMatchObject({ name: 'Billing', color: '#e8b955', tableIds: [] });
  });

  it('defaults missing erdGroups to [] (backward-compat proyek lama)', async () => {
    const cookie = await register('erdgroups2@test.dev');
    const projectId = await createProject(cookie);
    const { erdGroups, ...legacy } = emptyState;
    void erdGroups;
    const got = await putAndGet(cookie, projectId, legacy);
    expect(got.erdGroups).toEqual([]);
  });

  it('rejects invalid erdGroups (empty name, bad color)', async () => {
    const cookie = await register('erdgroups3@test.dev');
    const projectId = await createProject(cookie);
    for (const bad of [
      { ...baseGroup, name: '' },
      { ...baseGroup, color: 'red' },
      { ...baseGroup, tableIds: ['not-a-uuid'] },
    ]) {
      const put = await request(app)
        .put(`/api/v1/projects/${projectId}/state`)
        .set('Cookie', cookie)
        .set('X-Forwarded-For', uniqueIp())
        .send({ state: { ...emptyState, erdGroups: [bad] }, version: 1 });
      expect(put.status).toBe(400);
    }
  });

  it('supports granular POST / PATCH / DELETE area', async () => {
    const cookie = await register('erdgroups4@test.dev');
    const projectId = await createProject(cookie);
    const ip = () => ({ Cookie: cookie, 'X-Forwarded-For': uniqueIp() } as Record<string, string>);

    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/erdGroups`)
      .set(ip())
      .send({ name: 'Billing', color: null, tableIds: [] });
    expect(created.status).toBe(201);
    const id = created.body.entity.id as string;

    const patched = await request(app)
      .patch(`/api/v1/projects/${projectId}/erdGroups/${id}`)
      .set(ip())
      .send({ tableIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'] });
    expect(patched.status).toBe(200);
    expect(patched.body.entity.tableIds).toHaveLength(1);

    const patchedBad = await request(app)
      .patch(`/api/v1/projects/${projectId}/erdGroups/${id}`)
      .set(ip())
      .send({ name: '' });
    expect(patchedBad.status).toBe(400);

    const deleted = await request(app)
      .delete(`/api/v1/projects/${projectId}/erdGroups/${id}`)
      .set(ip());
    expect(deleted.status).toBe(200);
  });

  it('enforces the 20-areas cap', async () => {
    const cookie = await register('erdgroups5@test.dev');
    const projectId = await createProject(cookie);
    const many = Array.from({ length: 21 }, (_, i) => ({
      ...baseGroup,
      id: crypto.randomUUID(),
      name: `Area ${i}`,
    }));
    const put = await request(app)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state: { ...emptyState, erdGroups: many }, version: 1 });
    expect(put.status).toBe(400);
  });
});
