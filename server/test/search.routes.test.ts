import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, uniqueIp, register, createProject } from './helpers.js';
import { newId } from '../src/lib/ids.js';

const API = '/api/v1';

async function addEntity(
  cookie: string,
  projectId: string,
  key: string,
  body: Record<string, unknown>,
): Promise<string> {
  const res = await request(app)
    .post(`${API}/projects/${projectId}/${key}`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ id: newId(), ...body });
  expect(res.status).toBe(201);
  return res.body.entity.id;
}

async function search(cookie: string, q: string, limit?: number) {
  const req = request(app)
    .get(`${API}/search`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .query({ q });
  if (limit !== undefined) req.query({ limit });
  return req;
}

describe('global search API v1', () => {
  it('requires authentication', async () => {
    const res = await request(app)
      .get(`${API}/search`)
      .set('X-Forwarded-For', uniqueIp())
      .query({ q: 'alpha' });
    expect(res.status).toBe(401);
  });

  it('rejects queries shorter than 2 characters', async () => {
    const cookie = await register('search-short@test.dev');
    const res = await search(cookie, 'a');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns an empty result set when nothing matches', async () => {
    const cookie = await register('search-none@test.dev');
    const projectId = await createProject(cookie, 'Search none');
    await addEntity(cookie, projectId, 'tasks', {
      title: 'Unrelated task',
      status: 'todo',
      priority: 'medium',
      labels: [],
      blockedBy: [],
    });
    const res = await search(cookie, 'zzzzzz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [] });
  });

  it('searches across all member projects and groups hits per project', async () => {
    const cookie = await register('search-cross@test.dev');
    const first = await createProject(cookie, 'Search first');
    const second = await createProject(cookie, 'Search second');
    await addEntity(cookie, first, 'tasks', {
      title: 'Alpha task',
      status: 'todo',
      priority: 'medium',
      labels: [],
      blockedBy: [],
    });
    await addEntity(cookie, second, 'issues', {
      title: 'Alpha issue',
      severity: 'medium',
      status: 'open',
      description: '',
      reproduction: '',
    });
    const res = await search(cookie, 'alpha');
    expect(res.status).toBe(200);
    const results = res.body.results;
    expect(results).toHaveLength(2);
    const byName = Object.fromEntries(results.map((r: { projectName: string }) => [r.projectName, r]));
    expect(byName['Search first'].hits).toHaveLength(1);
    expect(byName['Search first'].hits[0].entity).toBe('tasks');
    expect(byName['Search second'].hits[0].entity).toBe('issues');
  });

  it('matches case-insensitively and ranks title hits above body hits', async () => {
    const cookie = await register('search-rank@test.dev');
    const projectId = await createProject(cookie, 'Search rank');
    const titleId = await addEntity(cookie, projectId, 'tasks', {
      title: 'ALPHA in title',
      status: 'todo',
      priority: 'medium',
      labels: [],
      blockedBy: [],
    });
    await addEntity(cookie, projectId, 'tasks', {
      title: 'Body only task',
      description: 'alpha in description',
      status: 'todo',
      priority: 'medium',
      labels: [],
      blockedBy: [],
    });
    const res = await search(cookie, 'alpha');
    expect(res.status).toBe(200);
    const hits = res.body.results[0].hits;
    expect(hits).toHaveLength(2);
    expect(hits[0].entityId).toBe(titleId);
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it('boosts prefix matches above substring matches', async () => {
    const cookie = await register('search-prefix@test.dev');
    const projectId = await createProject(cookie, 'Search prefix');
    await addEntity(cookie, projectId, 'tasks', {
      title: 'beta alpha',
      status: 'todo',
      priority: 'medium',
      labels: [],
      blockedBy: [],
    });
    const prefixId = await addEntity(cookie, projectId, 'tasks', {
      title: 'alpha one',
      status: 'todo',
      priority: 'medium',
      labels: [],
      blockedBy: [],
    });
    const res = await search(cookie, 'alpha');
    expect(res.status).toBe(200);
    const hits = res.body.results[0].hits;
    expect(hits).toHaveLength(2);
    expect(hits[0].entityId).toBe(prefixId);
  });

  it('searches nested fields such as decision options and endpoint paths', async () => {
    const cookie = await register('search-nested@test.dev');
    const projectId = await createProject(cookie, 'Search nested');
    const decisionId = await addEntity(cookie, projectId, 'decisions', {
      title: 'Storage choice',
      status: 'accepted',
      context: '',
      options: ['PostgreSQL jsonb', 'SQLite file'],
      decision: '',
      consequences: '',
      date: '2026-08-13',
    });
    const endpointId = await addEntity(cookie, projectId, 'apiEndpoints', {
      method: 'GET',
      path: '/api/v1/widgets',
      name: 'List widgets',
      description: '',
      headers: [],
      params: [],
      body: '',
      responses: [],
    });
    const optionsRes = await search(cookie, 'sqlite');
    expect(optionsRes.status).toBe(200);
    expect(optionsRes.body.results[0].hits[0].entityId).toBe(decisionId);
    const pathRes = await search(cookie, 'widgets');
    expect(pathRes.status).toBe(200);
    expect(pathRes.body.results[0].hits[0].entityId).toBe(endpointId);
  });

  it('caps results at 5 per entity', async () => {
    const cookie = await register('search-cap@test.dev');
    const projectId = await createProject(cookie, 'Search cap');
    for (let i = 0; i < 7; i += 1) {
      await addEntity(cookie, projectId, 'tasks', {
        title: `Cap task ${i} alpha`,
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
      });
    }
    const res = await search(cookie, 'alpha');
    expect(res.status).toBe(200);
    const hits = res.body.results[0].hits;
    expect(hits).toHaveLength(5);
  });

  it('respects the limit query parameter', async () => {
    const cookie = await register('search-limit@test.dev');
    const projectId = await createProject(cookie, 'Search limit');
    await addEntity(cookie, projectId, 'tasks', {
      title: 'Limit alpha one',
      status: 'todo',
      priority: 'medium',
      labels: [],
      blockedBy: [],
    });
    await addEntity(cookie, projectId, 'tasks', {
      title: 'Limit alpha two',
      status: 'todo',
      priority: 'medium',
      labels: [],
      blockedBy: [],
    });
    const res = await search(cookie, 'alpha', 1);
    expect(res.status).toBe(200);
    expect(res.body.results[0].hits).toHaveLength(1);
  });

  it('never exposes projects the user is not a member of', async () => {
    const owner = await register('search-owner@test.dev');
    const outsider = await register('search-outsider@test.dev');
    const projectId = await createProject(owner, 'Search private');
    await addEntity(owner, projectId, 'tasks', {
      title: 'Secret alpha task',
      status: 'todo',
      priority: 'medium',
      labels: [],
      blockedBy: [],
    });
    const res = await search(outsider, 'alpha');
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(0);
  });

  it('indexes whiteboard text elements and referenced entity titles without uuid or hex noise', async () => {
    const cookie = await register('search-whiteboard@test.dev');
    const projectId = await createProject(cookie);
    const milestoneId = await addEntity(cookie, projectId, 'milestones', {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Beta milestone ref',
      version: 'v0.2.0',
      status: 'planned',
    });
    const boardId = await addEntity(cookie, projectId, 'whiteboards', {
      name: 'Brainstorm board',
      elements: [
        {
          id: newId(),
          kind: 'sticky',
          x: 0,
          y: 0,
          w: 200,
          h: 120,
          color: '#e8b955',
          text: 'Meeting notes for Q3',
        },
        {
          id: newId(),
          kind: 'text',
          x: 0,
          y: 0,
          color: '#e4e4e7',
          fontSize: 16,
          text: 'Ship the sync service',
        },
        {
          id: newId(),
          kind: 'shape',
          shapeType: 'rect',
          x: 0,
          y: 0,
          w: 100,
          h: 60,
          color: '#6ea8fe',
          fill: false,
          strokeWidth: 2,
          label: 'Decide approach',
        },
        {
          id: newId(),
          kind: 'ref',
          entity: 'tasks',
          entityId: '11111111-1111-4111-8111-111111111111',
          x: 0,
          y: 0,
        },
        {
          id: newId(),
          kind: 'ref',
          entity: 'milestones',
          entityId: milestoneId,
          x: 0,
          y: 0,
        },
      ],
    });
    const taskId = await addEntity(cookie, projectId, 'tasks', {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Alpha ref task',
      status: 'todo',
      priority: 'medium',
      labels: [],
      blockedBy: [],
    });
    expect(taskId).toBe('11111111-1111-4111-8111-111111111111');

    const viaSticky = await search(cookie, 'meeting');
    expect(viaSticky.status).toBe(200);
    const stickyHits = viaSticky.body.results.flatMap((r: { hits: unknown[] }) => r.hits);
    expect(stickyHits.some((h: { entityId: string }) => h.entityId === boardId)).toBe(true);

    const viaRef = await search(cookie, 'ref task');
    expect(viaRef.status).toBe(200);
    const refHits = viaRef.body.results.flatMap((r: { hits: unknown[] }) => r.hits);
    expect(refHits.some((h: { entityId: string }) => h.entityId === boardId)).toBe(true);

    const viaMilestoneRef = await search(cookie, 'beta milestone');
    expect(viaMilestoneRef.status).toBe(200);
    const milestoneRefHits = viaMilestoneRef.body.results.flatMap((r: { hits: unknown[] }) => r.hits);
    expect(milestoneRefHits.some((h: { entityId: string }) => h.entityId === boardId)).toBe(true);

    const noNoise = await search(cookie, '#e4e4e7');
    expect(noNoise.status).toBe(200);
    expect(noNoise.body.results).toHaveLength(0);
  });

  it('searches tables, relations, and schema versions with derived titles', async () => {
    const cookie = await register('search-derived@test.dev');
    const projectId = await createProject(cookie, 'Search derived');
    const tb1 = await addEntity(cookie, projectId, 'tables', { name: 'users', columns: [] });
    const tb2 = await addEntity(cookie, projectId, 'tables', { name: 'projects', columns: [] });
    const col1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const col2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await addEntity(cookie, projectId, 'relations', {
      fromTableId: tb1,
      fromColumnId: col1,
      toTableId: tb2,
      toColumnId: col2,
      cardinality: '1:N',
      onDelete: 'cascade',
    });
    await addEntity(cookie, projectId, 'schemaVersions', {
      version: 'v0.1.0',
      notes: '',
      appliedAt: '2026-01-01T00:00:00.000Z',
    });

    const viaVersion = await search(cookie, 'v0.1');
    expect(viaVersion.status).toBe(200);
    const versionHits = viaVersion.body.results.flatMap((r: { hits: unknown[] }) => r.hits);
    expect(
      versionHits.some((h: { entity: string; title: string }) => h.entity === 'schemaVersions' && h.title === 'v0.1.0'),
    ).toBe(true);

    const viaTable = await search(cookie, 'users');
    expect(viaTable.status).toBe(200);
    const tableHits = viaTable.body.results.flatMap((r: { hits: unknown[] }) => r.hits);
    expect(tableHits.some((h: { entity: string; title: string }) => h.entity === 'tables' && h.title === 'users')).toBe(true);
    expect(
      tableHits.some(
        (h: { entity: string; title: string }) =>
          h.entity === 'relations' && h.title === `users.${col1} → projects.${col2}`,
      ),
    ).toBe(true);
  });
});
