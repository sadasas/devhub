import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db/pool.js';
import { app, createProject, getFirstTeamId, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

async function userIdOf(email: string): Promise<string> {
  const res = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
  return res.rows[0]!.id;
}

async function insertActivity(
  projectId: string,
  authorId: string,
  entity: string,
  entityId: string,
  action: 'created' | 'updated' | 'deleted',
  createdAt?: Date,
): Promise<void> {
  await pool.query(
    `INSERT INTO activity_log (project_id, entity, entity_id, action, author_id, author_name, summary, created_at)
     VALUES ($1, $2, $3, $4, $5, 'tester', $6, COALESCE($7, now()))`,
    [projectId, entity, entityId, action, authorId, `${action} ${entity}`, createdAt ?? null],
  );
}

describe('activity unread + read watermarks', () => {
  let ownerCookie: string;
  let outsiderCookie: string;
  let projectId: string;
  let authorId: string;

  beforeEach(async () => {
    await resetDb();
    ownerCookie = await register('owner@test.dev');
    outsiderCookie = await register('outsider@test.dev');
    const teamId = await getFirstTeamId(ownerCookie);
    projectId = await createProject(ownerCookie, 'Unread project', teamId);
    authorId = await userIdOf('owner@test.dev');
  });

  it('returns empty counts when there is no activity and no watermarks', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/activity/unread`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({});
    expect(res.body.ids).toEqual({});
    expect(res.body.deleted).toEqual([]);
    expect(res.body.watermarks).toEqual({});
  });

  it('counts all activity per tab when nothing has been read yet', async () => {
    await insertActivity(projectId, authorId, 'tasks', crypto.randomUUID(), 'created');
    await insertActivity(projectId, authorId, 'tasks', crypto.randomUUID(), 'updated');
    await insertActivity(projectId, authorId, 'issues', crypto.randomUUID(), 'created');

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/activity/unread`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ board: 2, issues: 1 });
    expect(res.body.ids.board).toHaveLength(2);
    expect(res.body.ids.issues).toHaveLength(1);
  });

  it('excludes activity older than the tab watermark after PUT', async () => {
    const oldTask = crypto.randomUUID();
    await insertActivity(projectId, authorId, 'tasks', oldTask, 'created');

    const put = await request(app)
      .put(`/api/v1/projects/${projectId}/read-watermarks/board`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(put.status).toBe(200);

    // Aktivitas SETELAH watermark dihitung; yang sebelum tidak.
    const newTask = crypto.randomUUID();
    await insertActivity(projectId, authorId, 'tasks', newTask, 'updated');

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/activity/unread`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.counts.board).toBe(1);
    expect(res.body.ids.board).toEqual([newTask]);
    expect(res.body.watermarks.board).toBeTruthy();
  });

  it('keeps watermarks isolated between users', async () => {
    await insertActivity(projectId, authorId, 'tasks', crypto.randomUUID(), 'created');
    await request(app)
      .put(`/api/v1/projects/${projectId}/read-watermarks/board`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());

    const ownerView = await request(app)
      .get(`/api/v1/projects/${projectId}/activity/unread`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(ownerView.body.counts.board).toBeUndefined();

    // Outsider bahkan tidak punya akses ke project.
    const outsider = await request(app)
      .get(`/api/v1/projects/${projectId}/activity/unread`)
      .set('Cookie', outsiderCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(outsider.status).toBe(404);
  });

  it('rejects unauthenticated requests and invalid tabs', async () => {
    const unauth = await request(app).get(`/api/v1/projects/${projectId}/activity/unread`);
    expect(unauth.status).toBe(401);

    const badTab = await request(app)
      .put(`/api/v1/projects/${projectId}/read-watermarks/not-a-tab`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(badTab.status).toBe(400);
  });

  it('lists recent deleted entries for the banner', async () => {
    await insertActivity(projectId, authorId, 'tasks', crypto.randomUUID(), 'deleted');
    await insertActivity(projectId, authorId, 'issues', crypto.randomUUID(), 'deleted');
    await insertActivity(projectId, authorId, 'tasks', crypto.randomUUID(), 'created');

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/activity/unread`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.deleted).toHaveLength(2);
    expect(res.body.deleted[0]!.summary).toContain('deleted');
  });
});
