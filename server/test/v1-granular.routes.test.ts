import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { app, uniqueIp, register, createProject, inviteUser, getFirstTeamId } from './helpers.js';
import { resetDb } from './setup.js';

const API = '/api/v1';

function uid() {
  return crypto.randomUUID();
}

describe('granular entity API v1', () => {
  beforeAll(async () => {
    await resetDb();
  });
  it('creates, lists, patches and deletes a task with version bumps and ETags', async () => {
    const cookie = await register('v1-task@test.dev');
    const projectId = await createProject(cookie);

    const created = await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: uid(), title: 'Granular task', status: 'todo', priority: 'medium', labels: [], blockedBy: [] });
    expect(created.status).toBe(201);
    expect(created.body.entity.title).toBe('Granular task');
    expect(created.body.version).toBe(2);
    expect(created.headers.etag).toBe('"2"');
    const taskId = created.body.entity.id;

    const list = await request(app)
      .get(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.nextCursor).toBeNull();
    expect(list.body.version).toBe(2);

    const fetched = await request(app)
      .get(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(fetched.status).toBe(200);
    expect(fetched.body.entity.title).toBe('Granular task');

    const patched = await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ status: 'done' });
    expect(patched.status).toBe(200);
    expect(patched.body.entity.status).toBe('done');
    expect(patched.body.version).toBe(3);
    expect(patched.headers.etag).toBe('"3"');

    const deleted = await request(app)
      .delete(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ ok: true, version: 4 });

    const state = await request(app)
      .get(`${API}/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(state.body.state.tasks).toHaveLength(0);
    expect(state.body.version).toBe(4);
  });

  it('round-trips a whiteboard with a discriminated element union and enforces caps', async () => {
    const cookie = await register('v1-board@test.dev');
    const projectId = await createProject(cookie);

    const taskCreated = await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: uid(), title: 'Referenced', status: 'todo', priority: 'medium', labels: [], blockedBy: [] });
    expect(taskCreated.status).toBe(201);
    const taskId = taskCreated.body.entity.id;

    const strokeId = uid();
    const boxId = uid();
    const elements = [
      { id: strokeId, kind: 'stroke', tool: 'pen', color: '#34c38e', width: 3, thinning: 2, points: [[0, 0], [10, 20], [40, 20]] },
      { id: uid(), kind: 'sticky', x: 100, y: 100, w: 200, h: 120, color: '#e8b955', text: 'Note' },
      { id: uid(), kind: 'text', x: 50, y: 50, color: '#e4e4e7', fontSize: 16, text: 'Hello' },
      { id: boxId, kind: 'shape', shapeType: 'diamond', x: 0, y: 0, w: 120, h: 80, color: '#6ea8fe', fill: true, strokeWidth: 2, label: 'Decide' },
      { id: uid(), kind: 'edge', x1: 10, y1: 10, x2: 300, y2: 200, color: '#e4e4e7', width: 2, arrowhead: true, sourceNodeId: strokeId, targetNodeId: boxId },
      { id: uid(), kind: 'ref', entity: 'tasks', entityId: taskId, x: 400, y: 400 },
    ];

    const created = await request(app)
      .post(`${API}/projects/${projectId}/whiteboards`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: uid(), name: 'Plan', description: 'board', elements });
    expect(created.status).toBe(201);
    expect(created.body.version).toBe(3);
    expect(created.body.entity.elements).toHaveLength(6);
    const kinds = (created.body.entity.elements as Array<{ kind: string }>).map((e) => e.kind);
    expect(kinds).toEqual(['stroke', 'sticky', 'text', 'shape', 'edge', 'ref']);
    const boardId = created.body.entity.id;

    const list = await request(app)
      .get(`${API}/projects/${projectId}/whiteboards`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);

    const patched = await request(app)
      .patch(`${API}/projects/${projectId}/whiteboards/${boardId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Renamed' });
    expect(patched.status).toBe(200);
    expect(patched.body.entity.name).toBe('Renamed');
    expect(patched.body.version).toBe(4);

    const tooMany = [...Array(1001)].map((_, i) => ({
      id: uid(),
      kind: 'text' as const,
      x: i,
      y: i,
      color: '#e4e4e7',
      fontSize: 16,
      text: 'x',
    }));
    const rejected = await request(app)
      .post(`${API}/projects/${projectId}/whiteboards`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: uid(), name: 'Burst', elements: tooMany });
    expect(rejected.status).toBe(400);

    const shortStroke = await request(app)
      .post(`${API}/projects/${projectId}/whiteboards`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: uid(), name: 'OnePoint', elements: [{ id: uid(), kind: 'stroke', tool: 'pen', points: [[0, 0]] }] });
    expect(shortStroke.status).toBe(400);

    const deleted = await request(app)
      .delete(`${API}/projects/${projectId}/whiteboards/${boardId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ ok: true, version: 5 });
  });

  it('enforces the five-board cap per project', async () => {
    const cookie = await register('v1-boardcap@test.dev');
    const projectId = await createProject(cookie);

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post(`${API}/projects/${projectId}/whiteboards`)
        .set('Cookie', cookie)
        .set('X-Forwarded-For', uniqueIp())
        .send({ id: uid(), name: `Board ${i}`, elements: [] });
      expect(res.status).toBe(201);
    }

    const sixth = await request(app)
      .post(`${API}/projects/${projectId}/whiteboards`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: uid(), name: 'Sixth', elements: [] });
    expect(sixth.status).toBe(400);
  });

  it('creates nested tables with columns and cascades relations on table delete', async () => {
    const cookie = await register('v1-table@test.dev');
    const projectId = await createProject(cookie);

    const table = await request(app)
      .post(`${API}/projects/${projectId}/tables`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: uid(),
        name: 'users',
        comment: '',
        columns: [
          { id: uid(), name: 'id', type: 'uuid', nullable: false, primaryKey: true, comment: '' },
        ],
        indexes: [],
      });
    expect(table.status).toBe(201);
    const fromColumnId = table.body.entity.columns[0].id;

    const other = await request(app)
      .post(`${API}/projects/${projectId}/tables`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: uid(), name: 'posts', comment: '', columns: [], indexes: [] });
    const toColumnId = uid();

    const relation = await request(app)
      .post(`${API}/projects/${projectId}/relations`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: uid(),
        fromTableId: table.body.entity.id,
        fromColumnId,
        toTableId: other.body.entity.id,
        toColumnId,
        cardinality: '1:N',
        onDelete: 'cascade',
      });
    expect(relation.status).toBe(201);

    await request(app)
      .delete(`${API}/projects/${projectId}/tables/${table.body.entity.id}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .expect(200);

    const relations = await request(app)
      .get(`${API}/projects/${projectId}/relations`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(relations.body.items).toHaveLength(0);
  });

  it('clears milestoneId, linkedTaskId and collectionId on delete', async () => {
    const cookie = await register('v1-cascade@test.dev');
    const projectId = await createProject(cookie);

    const milestoneId = uid();
    await request(app)
      .post(`${API}/projects/${projectId}/milestones`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: milestoneId, name: 'M8', status: 'planned', changelog: '' })
      .expect(201);

    const taskId = uid();
    await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: taskId, title: 'Cascade task', status: 'todo', priority: 'medium', labels: [], blockedBy: [], milestoneId })
      .expect(201);

    const issueId = uid();
    await request(app)
      .post(`${API}/projects/${projectId}/issues`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: issueId, title: 'Linked issue', severity: 'medium', status: 'open', linkedTaskId: taskId })
      .expect(201);

    const collectionId = uid();
    await request(app)
      .post(`${API}/projects/${projectId}/apiCollections`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: collectionId, name: 'Users' })
      .expect(201);

    await request(app)
      .post(`${API}/projects/${projectId}/apiEndpoints`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: uid(), collectionId, method: 'GET', path: '/users', name: 'List', headers: [], params: [], body: '', responses: [] })
      .expect(201);

    await request(app)
      .delete(`${API}/projects/${projectId}/milestones/${milestoneId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .expect(200);
    await request(app)
      .delete(`${API}/projects/${projectId}/apiCollections/${collectionId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .expect(200);

    const task = await request(app)
      .get(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(task.body.entity.milestoneId).toBeNull();

    await request(app)
      .delete(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .expect(200);

    const issue = await request(app)
      .get(`${API}/projects/${projectId}/issues/${issueId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(issue.body.entity.linkedTaskId).toBeNull();

    const endpoints = await request(app)
      .get(`${API}/projects/${projectId}/apiEndpoints`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(endpoints.body.items[0].collectionId).toBeNull();
  });

  it('rejects stale If-Match with 409 and accepts the current version', async () => {
    const cookie = await register('v1-conflict@test.dev');
    const projectId = await createProject(cookie);
    const taskId = uid();

    const created = await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: taskId, title: 'Conflict task', status: 'todo', priority: 'medium', labels: [], blockedBy: [] })
      .expect(201);
    expect(created.body.version).toBe(2);

    const stale = await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .set('If-Match', '"1"')
      .send({ status: 'done' });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONFLICT');
    expect(stale.body.error.details.current.version).toBe(2);

    const ok = await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .set('If-Match', '"2"')
      .send({ status: 'done' });
    expect(ok.status).toBe(200);
    expect(ok.body.version).toBe(3);

    const withoutHeader = await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ priority: 'high' });
    expect(withoutHeader.status).toBe(200);
    expect(withoutHeader.body.version).toBe(4);
  });

  it('paginates lists with an after cursor', async () => {
    const cookie = await register('v1-page@test.dev');
    const projectId = await createProject(cookie);
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`${API}/projects/${projectId}/tasks`)
        .set('Cookie', cookie)
        .set('X-Forwarded-For', uniqueIp())
        .send({ id: uid(), title: `Task ${i}`, status: 'todo', priority: 'medium', labels: [], blockedBy: [] })
        .expect(201);
    }

    const first = await request(app)
      .get(`${API}/projects/${projectId}/tasks?limit=2`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).toBe(first.body.items[1].id);

    const second = await request(app)
      .get(`${API}/projects/${projectId}/tasks?limit=2&after=${first.body.nextCursor}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
  });

  it('enforces roles: viewer read-only, non-member hidden', async () => {
    const ownerCookie = await register('v1-owner@test.dev');
    const viewerCookie = await register('v1-viewer@test.dev');
    const projectId = await createProject(ownerCookie);
    await inviteUser(ownerCookie, viewerCookie, await getFirstTeamId(ownerCookie), 'viewer');
    const taskId = uid();

    const create = await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', viewerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: taskId, title: 'Nope', status: 'todo', priority: 'medium', labels: [], blockedBy: [] });
    expect(create.status).toBe(403);

    const owner = await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: taskId, title: 'Owner task', status: 'todo', priority: 'medium', labels: [], blockedBy: [] })
      .expect(201);

    const patch = await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', viewerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ status: 'done' });
    expect(patch.status).toBe(403);

    const del = await request(app)
      .delete(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', viewerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(del.status).toBe(403);

    const list = await request(app)
      .get(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', viewerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(owner.body.entity.title).toBe('Owner task');

    const stranger = await register('v1-stranger@test.dev');
    const hidden = await request(app)
      .get(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', stranger)
      .set('X-Forwarded-For', uniqueIp());
    expect(hidden.status).toBe(404);
  });
});
