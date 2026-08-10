import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createProject, createTeam, getFirstTeamId, inviteUser, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/schema/state.js';

describe('projects routes', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  it('creates a project in a team and lists it with the role', async () => {
    const cookie = await register('owner@test.dev');
    const teamId = await getFirstTeamId(cookie);
    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'My app', description: 'Desc', teamId });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My app');
    expect(res.body.teamId).toBe(teamId);
    expect(res.body.role).toBe('owner');

    const list = await request(app)
      .get('/api/projects')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(200);
    expect(list.body.projects).toHaveLength(1);
    expect(list.body.projects[0].id).toBe(res.body.id);
  });

  it('rejects creating a project in a team the user cannot write to', async () => {
    const ownerCookie = await register('owner2@test.dev');
    const memberCookie = await register('viewer2@test.dev');
    const teamId = await createTeam(ownerCookie);
    await inviteUser(ownerCookie, memberCookie, teamId, 'viewer');

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', memberCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Nope', teamId });
    expect(res.status).toBe(403);
  });

  it('allows editors to create projects', async () => {
    const ownerCookie = await register('owner3@test.dev');
    const editorCookie = await register('editor3@test.dev');
    const teamId = await createTeam(ownerCookie);
    await inviteUser(ownerCookie, editorCookie, teamId, 'editor');

    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', editorCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Editable', teamId });
    expect(res.status).toBe(201);
  });

  it('hides projects from non-members', async () => {
    const cookie = await register('owner4@test.dev');
    const projectId = await createProject(cookie);
    const outsider = await register('outsider@test.dev');

    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', outsider)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(404);
  });

  it('patches a project as a writer and rejects viewers', async () => {
    const ownerCookie = await register('owner5@test.dev');
    const memberCookie = await register('viewer5@test.dev');
    const teamId = await createTeam(ownerCookie);
    await inviteUser(ownerCookie, memberCookie, teamId, 'viewer');
    const projectId = await createProject(ownerCookie, 'Test project', teamId);

    const patched = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Renamed' });
    expect(patched.status).toBe(200);
    expect(patched.body.name).toBe('Renamed');

    const denied = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Cookie', memberCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Nope' });
    expect(denied.status).toBe(403);
  });

  it('round-trips project state via PUT and GET', async () => {
    const cookie = await register('state@test.dev');
    const projectId = await createProject(cookie);
    const state = {
      ...emptyState,
      tasks: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          title: 'Shipped task',
          status: 'done',
          priority: 'high',
          estimate: 3,
          labels: ['backend'],
          blockedBy: [],
          description: 'Round trip',
        },
      ],
    };

    const put = await request(app)
      .put(`/api/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state });
    expect(put.status).toBe(200);

    const get = await request(app)
      .get(`/api/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(get.status).toBe(200);
    expect(get.body.state.tasks).toHaveLength(1);
    expect(get.body.state.tasks[0].title).toBe('Shipped task');
  });

  it('rejects state writes from viewers', async () => {
    const ownerCookie = await register('owner6@test.dev');
    const memberCookie = await register('viewer6@test.dev');
    const teamId = await createTeam(ownerCookie);
    await inviteUser(ownerCookie, memberCookie, teamId, 'viewer');
    const projectId = await createProject(ownerCookie, 'Test project', teamId);

    const res = await request(app)
      .put(`/api/projects/${projectId}/state`)
      .set('Cookie', memberCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state: emptyState });
    expect(res.status).toBe(403);
  });

  it('deletes a project as admin and rejects editors', async () => {
    const ownerCookie = await register('owner7@test.dev');
    const editorCookie = await register('editor7@test.dev');
    const teamId = await createTeam(ownerCookie);
    await inviteUser(ownerCookie, editorCookie, teamId, 'editor');
    const projectId = await createProject(ownerCookie, 'Test project', teamId);

    const denied = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Cookie', editorCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(ok.status).toBe(200);

    const gone = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(gone.status).toBe(404);
  });

  it('exports a project document with meta', async () => {
    const cookie = await register('export@test.dev');
    const projectId = await createProject(cookie);

    const res = await request(app)
      .get(`/api/projects/${projectId}/export`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.meta.app).toBe('devhub');
    expect(res.body.meta.projectId).toBe(projectId);
    expect(res.body.state).toBeDefined();
  });

  it('imports into an existing project when accessible', async () => {
    const cookie = await register('import@test.dev');
    const projectId = await createProject(cookie);

    const exported = await request(app)
      .get(`/api/projects/${projectId}/export`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    const doc = exported.body;
    doc.state = { ...doc.state, tasks: [] };

    const restored = await request(app)
      .post('/api/projects/import')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send(doc);
    expect(restored.status).toBe(200);
    expect(restored.body.restored).toBe(true);
  });

  it('imports into a new project for an unknown project id', async () => {
    const cookie = await register('import2@test.dev');
    const doc = {
      meta: {
        app: 'devhub',
        version: '0.1.0',
        exportedAt: '2026-01-01T00:00:00.000Z',
        projectId: '44444444-4444-4444-8444-444444444444',
      },
      state: emptyState,
    };

    const res = await request(app)
      .post('/api/projects/import')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send(doc);
    expect(res.status).toBe(201);
    expect(res.body.restored).toBe(false);
    expect(res.body.projectId).toBeDefined();

    const list = await request(app)
      .get('/api/projects')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.body.projects[0].name).toMatch(/^Imported \d{4}-\d{2}-\d{2}$/);
  });
});
