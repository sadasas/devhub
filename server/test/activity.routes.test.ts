import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, uniqueIp, register, createProject, inviteUser, getFirstTeamId } from './helpers.js';
import { resetDb } from './setup.js';

const API = '/api/v1';

function uid() {
  return crypto.randomUUID();
}

interface ActivityRow {
  id: string;
  projectId: string;
  entity: string;
  entityId: string;
  action: string;
  authorId: string | null;
  authorName: string;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
}

async function fetchActivity(cookie: string, projectId: string, query = ''): Promise<ActivityRow[]> {
  const res = await request(app)
    .get(`${API}/projects/${projectId}/activity${query}`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  return res.body.items as ActivityRow[];
}

describe('activity log API v1', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('records created, updated and deleted entries with summary and changes', async () => {
    const cookie = await register('activity-lifecycle@test.dev');
    const projectId = await createProject(cookie);
    const taskId = uid();

    const created = await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: taskId, title: 'Activity task', status: 'todo', priority: 'medium', labels: [], blockedBy: [] });
    expect(created.status).toBe(201);

    const patched = await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ status: 'done' });
    expect(patched.status).toBe(200);

    const deleted = await request(app)
      .delete(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(deleted.status).toBe(200);

    const items = await fetchActivity(cookie, projectId, `?entity=tasks&entityId=${taskId}`);
    expect(items).toHaveLength(3);

    const [del, upd, cre] = items;
    expect(cre!.action).toBe('created');
    expect(cre!.summary).toBe('Activity task');
    expect(cre!.authorId).not.toBeNull();

    expect(upd!.action).toBe('updated');
    expect(upd!.changes.status).toEqual({ from: 'todo', to: 'done' });

    expect(del!.action).toBe('deleted');
    expect(del!.summary).toBe('Activity task');
  });

  it('writes no activity on validation error or version conflict', async () => {
    const cookie = await register('activity-conflict@test.dev');
    const projectId = await createProject(cookie);
    const taskId = uid();

    const invalid = await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: taskId, title: '' });
    expect(invalid.status).toBe(400);

    const conflict = await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .set('If-Match', '"999"')
      .send({ status: 'done' });
    expect(conflict.status).toBe(409);

    const items = await fetchActivity(cookie, projectId);
    expect(items).toHaveLength(0);
  });

  it('clusters rapid updates from the same author into one row', async () => {
    const cookie = await register('activity-cluster@test.dev');
    const projectId = await createProject(cookie);
    const taskId = uid();

    await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: taskId, title: 'Cluster task', status: 'todo', priority: 'medium', labels: [], blockedBy: [] });

    await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ priority: 'high' });

    await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ status: 'inProgress' });

    const items = await fetchActivity(cookie, projectId, `?entity=tasks&entityId=${taskId}`);
    expect(items).toHaveLength(2);
    const updated = items.find((i) => i.action === 'updated');
    expect(updated).toBeDefined();
    expect(updated!.changes.priority).toEqual({ from: 'medium', to: 'high' });
    expect(updated!.changes.status).toEqual({ from: 'todo', to: 'inProgress' });
  });

  it('keeps separate rows for different authors', async () => {
    const owner = await register('activity-owner@test.dev');
    const editor = await register('activity-editor@test.dev');
    const teamId = await getFirstTeamId(owner);
    await inviteUser(owner, editor, teamId, 'editor');
    const projectId = await createProject(owner);
    const taskId = uid();

    await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: taskId, title: 'Multi author', status: 'todo', priority: 'medium', labels: [], blockedBy: [] });

    await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ priority: 'high' });

    await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', editor)
      .set('X-Forwarded-For', uniqueIp())
      .send({ status: 'done' });

    const items = await fetchActivity(owner, projectId, `?entity=tasks&entityId=${taskId}`);
    expect(items).toHaveLength(3);
    expect(items.filter((i) => i.action === 'updated')).toHaveLength(2);
  });

  it('lets viewers read activity but hides it from non-members', async () => {
    const owner = await register('activity-vis-owner@test.dev');
    const viewer = await register('activity-vis-viewer@test.dev');
    const outsider = await register('activity-vis-out@test.dev');
    const teamId = await getFirstTeamId(owner);
    await inviteUser(owner, viewer, teamId, 'viewer');
    const projectId = await createProject(owner);

    await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: uid(), title: 'Visible task', status: 'todo', priority: 'medium', labels: [], blockedBy: [] });

    const asViewer = await fetchActivity(viewer, projectId);
    expect(asViewer).toHaveLength(1);

    const asOutsider = await request(app)
      .get(`${API}/projects/${projectId}/activity`)
      .set('Cookie', outsider)
      .set('X-Forwarded-For', uniqueIp());
    expect(asOutsider.status).toBe(404);
  });

  it('requires authentication and applies limit and entity filters', async () => {
    const cookie = await register('activity-filter@test.dev');
    const projectId = await createProject(cookie);

    for (const i of [1, 2, 3]) {
      await request(app)
        .post(`${API}/projects/${projectId}/tasks`)
        .set('Cookie', cookie)
        .set('X-Forwarded-For', uniqueIp())
        .send({ id: uid(), title: `Filter task ${i}`, status: 'todo', priority: 'medium', labels: [], blockedBy: [] });
    }

    const limited = await fetchActivity(cookie, projectId, '?limit=2');
    expect(limited).toHaveLength(2);

    const filtered = await fetchActivity(cookie, projectId, '?entity=tasks');
    expect(filtered).toHaveLength(3);

    const unauth = await request(app).get(`${API}/projects/${projectId}/activity`);
    expect(unauth.status).toBe(401);

    const badLimit = await request(app)
      .get(`${API}/projects/${projectId}/activity?limit=9999`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(badLimit.status).toBe(400);
  });

  it('filters activity by authorId', async () => {
    const owner = await register('activity-author-owner@test.dev');
    const editor = await register('activity-author-editor@test.dev');
    const teamId = await getFirstTeamId(owner);
    await inviteUser(owner, editor, teamId, 'editor');
    const projectId = await createProject(owner);
    const taskId = uid();

    await request(app)
      .post(`${API}/projects/${projectId}/tasks`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ id: taskId, title: 'Author filter', status: 'todo', priority: 'medium', labels: [], blockedBy: [] });

    await request(app)
      .patch(`${API}/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', editor)
      .set('X-Forwarded-For', uniqueIp())
      .send({ status: 'done' });

    const all = await fetchActivity(owner, projectId);
    const ownerId = all.find((i) => i.action === 'created')!.authorId!;
    const editorId = all.find((i) => i.action === 'updated')!.authorId!;

    const byOwner = await fetchActivity(owner, projectId, `?authorId=${ownerId}`);
    expect(byOwner).toHaveLength(1);
    expect(byOwner[0]!.action).toBe('created');

    const byEditor = await fetchActivity(owner, projectId, `?authorId=${editorId}`);
    expect(byEditor).toHaveLength(1);
    expect(byEditor[0]!.action).toBe('updated');

    const badAuthor = await request(app)
      .get(`${API}/projects/${projectId}/activity?authorId=not-a-uuid`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(badAuthor.status).toBe(400);
  });

  it('summarises whiteboard element changes with a count diff instead of a JSON dump', async () => {
    const cookie = await register('activity-whiteboard@test.dev');
    const projectId = await createProject(cookie);
    const boardId = uid();

    const stroke = (id: string, x: number) => ({
      id,
      kind: 'stroke',
      tool: 'pen',
      color: '#e4e4e7',
      width: 2,
      thinning: 2,
      points: [
        [x, 0],
        [x, 10],
      ],
    });

    const created = await request(app)
      .post(`${API}/projects/${projectId}/whiteboards`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: boardId,
        name: 'Plan',
        elements: [stroke(uid(), 0), stroke(uid(), 10), stroke(uid(), 20)],
      });
    expect(created.status).toBe(201);

    const patched = await request(app)
      .patch(`${API}/projects/${projectId}/whiteboards/${boardId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        elements: [stroke(uid(), 0), stroke(uid(), 10), stroke(uid(), 20), stroke(uid(), 30), stroke(uid(), 40)],
      });
    expect(patched.status).toBe(200);

    const items = await fetchActivity(cookie, projectId, `?entity=whiteboards&entityId=${boardId}`);
    expect(items).toHaveLength(2);
    const upd = items.find((i) => i.action === 'updated');
    expect(upd).toBeDefined();
    expect(upd!.summary).toContain('elements: 3 → 5');
    expect(upd!.changes.elements).toEqual({ from: 3, to: 5 });
    expect(JSON.stringify(upd!.changes.elements)).not.toContain('"kind"');
  });
});
