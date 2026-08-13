import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createProject, createTeam, inviteUser, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/schema/state.js';

async function makePublic(cookie: string, projectId: string): Promise<void> {
  const res = await request(app)
    .patch(`/api/v1/projects/${projectId}`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ visibility: 'public' });
  expect(res.status).toBe(200);
}

describe('public project routes', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('serves the project meta without authentication when public', async () => {
    const cookie = await register('pub-meta@test.dev');
    const projectId = await createProject(cookie, 'Public meta');
    await makePublic(cookie, projectId);

    const res = await request(app)
      .get(`/api/v1/public/projects/${projectId}`)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('Public meta');
    expect(res.body.project.visibility).toBe('public');
    expect(res.body.project.teamName).toBeDefined();
    expect(res.body.project.role).toBeUndefined();
  });

  it('serves the full state without authentication when public', async () => {
    const cookie = await register('pub-state@test.dev');
    const projectId = await createProject(cookie);
    await makePublic(cookie, projectId);

    const seed = await request(app)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        state: {
          ...emptyState,
          tasks: [
            {
              id: '33333333-3333-4333-8333-333333333333',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              title: 'Visible task',
              status: 'todo',
              priority: 'medium',
              estimate: 1,
              labels: [],
              blockedBy: [],
              description: 'Visible',
            },
          ],
        },
        version: 1,
      });
    expect(seed.status).toBe(200);

    const res = await request(app)
      .get(`/api/v1/public/projects/${projectId}/state`)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.state.tasks).toHaveLength(1);
    expect(res.body.state.tasks[0].title).toBe('Visible task');
  });

  it('returns 404 for a private project', async () => {
    const cookie = await register('private@test.dev');
    const projectId = await createProject(cookie);

    const meta = await request(app)
      .get(`/api/v1/public/projects/${projectId}`)
      .set('X-Forwarded-For', uniqueIp());
    expect(meta.status).toBe(404);

    const state = await request(app)
      .get(`/api/v1/public/projects/${projectId}/state`)
      .set('X-Forwarded-For', uniqueIp());
    expect(state.status).toBe(404);
  });

  it('returns 404 for an invalid project id', async () => {
    const res = await request(app)
      .get('/api/v1/public/projects/not-a-uuid')
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(404);
  });

  it('creates projects as private by default', async () => {
    const cookie = await register('default-priv@test.dev');
    const teamId = await createTeam(cookie);
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Default private', teamId });
    expect(res.status).toBe(201);
    expect(res.body.visibility).toBe('private');
  });

  it('lets owners toggle visibility, rejects editors and rejects non-admins on public', async () => {
    const ownerCookie = await register('vis-owner@test.dev');
    const editorCookie = await register('vis-editor@test.dev');
    const viewerCookie = await register('vis-viewer@test.dev');
    const teamId = await createTeam(ownerCookie);
    await inviteUser(ownerCookie, editorCookie, teamId, 'editor');
    const projectId = await createProject(ownerCookie, 'Toggle me', teamId);

    const asEditor = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('Cookie', editorCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ visibility: 'public' });
    expect(asEditor.status).toBe(403);

    const asOwner = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ visibility: 'public' });
    expect(asOwner.status).toBe(200);
    expect(asOwner.body.visibility).toBe('public');

    await inviteUser(ownerCookie, viewerCookie, teamId, 'viewer');
    const asViewer = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('Cookie', viewerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ visibility: 'private' });
    expect(asViewer.status).toBe(403);

    const hidden = await request(app)
      .get(`/api/v1/public/projects/${projectId}`)
      .set('X-Forwarded-For', uniqueIp());
    expect(hidden.status).toBe(200);

    const revert = await request(app)
      .patch(`/api/v1/projects/${projectId}`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ visibility: 'private' });
    expect(revert.status).toBe(200);
    const gone = await request(app)
      .get(`/api/v1/public/projects/${projectId}`)
      .set('X-Forwarded-For', uniqueIp());
    expect(gone.status).toBe(404);
  });
});