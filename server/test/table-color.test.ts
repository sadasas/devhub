import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createProject, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/modules/projects/domain/state.js';

describe('table color (U1 zod-only, no DB migration)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  const baseTable = {
    id: '99999999-9999-4999-8999-999999999999',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'users',
    comment: '',
    columns: [],
    indexes: [],
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

  it('round-trips color via PUT and GET state', async () => {
    const cookie = await register('tablecolor@test.dev');
    const projectId = await createProject(cookie);
    const state = { ...emptyState, tables: [{ ...baseTable, color: '#ff0000' }] };

    const got = await putAndGet(cookie, projectId, state);
    expect(got.tables[0].color).toBe('#ff0000');
  });

  it('treats missing color on legacy tables as null-ish (backward-compat)', async () => {
    const cookie = await register('tablecolor2@test.dev');
    const projectId = await createProject(cookie);
    // legacy: tanpa field color sama sekali — tetap valid, terbaca null-ish
    const legacy = await putAndGet(cookie, projectId, { ...emptyState, tables: [{ ...baseTable }] });
    expect(legacy.tables[0].color ?? null).toBeNull();
  });

  it('preserves explicit null color and strips unknown fields', async () => {
    const cookie = await register('tablecolor3@test.dev');
    const projectId = await createProject(cookie);
    const state = { ...emptyState, tables: [{ ...baseTable, color: null, bogusField: 'nope' }] };

    const got = await putAndGet(cookie, projectId, state);
    expect(got.tables[0].color).toBeNull();
    expect(got.tables[0].bogusField).toBeUndefined();
  });

  it.each(['red', '#12345', '#gggggg'])('rejects invalid color %s with 400', async (color) => {
    const cookie = await register(`tablecolor-bad-${color.replace(/[^a-z0-9]/gi, '')}@test.dev`);
    const projectId = await createProject(cookie);
    const state = { ...emptyState, tables: [{ ...baseTable, color }] };

    const put = await request(app)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state, version: 1 });
    expect(put.status).toBe(400);
  });

  it('round-trips color via granular entity API and schema snapshot', async () => {
    const cookie = await register('tablecolor4@test.dev');
    const projectId = await createProject(cookie);

    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/tables`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ ...baseTable, color: '#00ff00' });
    expect(created.status).toBe(201);
    expect(created.body.entity.color).toBe('#00ff00');
    const tableId = created.body.entity.id as string;

    const patched = await request(app)
      .patch(`/api/v1/projects/${projectId}/tables/${tableId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ color: '#0000ff' });
    expect(patched.status).toBe(200);
    expect(patched.body.entity.color).toBe('#0000ff');

    const badPatch = await request(app)
      .patch(`/api/v1/projects/${projectId}/tables/${tableId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ color: 'red' });
    expect(badPatch.status).toBe(400);

    // snapshot ikut otomatis (pakai tableSchema yang sama)
    const versionId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const sv = await request(app)
      .post(`/api/v1/projects/${projectId}/schemaVersions`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: versionId,
        version: 'v1',
        appliedAt: '2026-01-01T00:00:00.000Z',
        notes: '',
        snapshot: { tables: [{ ...baseTable, id: tableId, color: '#123abc' }], relations: [] },
      });
    expect(sv.status).toBe(201);
    expect(sv.body.entity.snapshot.tables[0].color).toBe('#123abc');
  });
});
