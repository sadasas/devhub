import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, register, getFirstTeamId, createTeam, createProject, inviteUser, uniqueIp } from './helpers.js';

async function seedState(cookie: string, projectId: string): Promise<void> {
  const state = {
    tasks: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        title: 'Template task',
        status: 'todo',
        priority: 'high',
        labels: [],
        blockedBy: [],
        description: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
  const res = await request(app)
    .put(`/api/v1/projects/${projectId}/state`)
    .set('Cookie', cookie)
    .send({ state, version: 1 });
  expect(res.status).toBe(200);
}

async function saveTemplate(cookie: string, projectId: string, name = 'Sprint starter'): Promise<string> {
  const res = await request(app)
    .post('/api/v1/templates')
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ projectId, name });
  expect(res.status).toBe(201);
  return (res.body.template as { id: string }).id;
}

describe('templates', () => {
  it('saves a template from a project and lists it for the team', async () => {
    const owner = await register('tpl-owner@test.dev');
    const projectId = await createProject(owner, 'Source project');
    await seedState(owner, projectId);
    const templateId = await saveTemplate(owner, projectId);

    const list = await request(app)
      .get('/api/v1/templates')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(200);
    expect(list.body.templates).toHaveLength(1);
    expect(list.body.templates[0]).toMatchObject({ id: templateId, name: 'Sprint starter', teamName: 'Personal' });

    const single = await request(app)
      .get(`/api/v1/templates/${templateId}`)
      .set('Cookie', owner);
    expect(single.status).toBe(200);
    expect(single.body.template.state.tasks).toHaveLength(1);
  });

  it('instantiate creates a new project with the template state', async () => {
    const owner = await register('tpl-inst@test.dev');
    const projectId = await createProject(owner, 'Source');
    await seedState(owner, projectId);
    const templateId = await saveTemplate(owner, projectId);

    const res = await request(app)
      .post(`/api/v1/templates/${templateId}/instantiate`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Sprint 42' });
    expect(res.status).toBe(201);
    const newProjectId = res.body.projectId as string;

    const state = await request(app)
      .get(`/api/v1/projects/${newProjectId}/state`)
      .set('Cookie', owner);
    expect(state.status).toBe(200);
    expect(state.body.state.tasks[0]?.title).toBe('Template task');
    expect(state.body.version).toBe(1);
  });

  it('non-member cannot save a template from a project', async () => {
    const owner = await register('tpl-own2@test.dev');
    const outsider = await register('tpl-outs@test.dev');
    const projectId = await createProject(owner, 'Private source');
    const res = await request(app)
      .post('/api/v1/templates')
      .set('Cookie', outsider)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId, name: 'Nope' });
    expect(res.status).toBe(404);
  });

  it('viewer cannot save a template', async () => {
    const owner = await register('tpl-own3@test.dev');
    const viewer = await register('tpl-view@test.dev');
    const teamId = await getFirstTeamId(owner);
    await inviteUser(owner, viewer, teamId, 'viewer');
    const projectId = await createProject(owner, 'Source', teamId);
    const res = await request(app)
      .post('/api/v1/templates')
      .set('Cookie', viewer)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId, name: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('viewer cannot instantiate a template', async () => {
    const owner = await register('tpl-own4@test.dev');
    const viewer = await register('tpl-view2@test.dev');
    const teamId = await getFirstTeamId(owner);
    await inviteUser(owner, viewer, teamId, 'viewer');
    const projectId = await createProject(owner, 'Source', teamId);
    const templateId = await saveTemplate(owner, projectId);

    const res = await request(app)
      .post(`/api/v1/templates/${templateId}/instantiate`)
      .set('Cookie', viewer)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(403);
  });

  it('non-admin cannot delete a template; admin can', async () => {
    const owner = await register('tpl-own5@test.dev');
    const editor = await register('tpl-editor@test.dev');
    const teamId = await getFirstTeamId(owner);
    await inviteUser(owner, editor, teamId, 'editor');
    const projectId = await createProject(owner, 'Source', teamId);
    const templateId = await saveTemplate(owner, projectId);

    const denied = await request(app)
      .delete(`/api/v1/templates/${templateId}`)
      .set('Cookie', editor)
      .set('X-Forwarded-For', uniqueIp());
    expect(denied.status).toBe(403);

    const allowed = await request(app)
      .delete(`/api/v1/templates/${templateId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(allowed.status).toBe(200);

    const list = await request(app)
      .get('/api/v1/templates')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.body.templates).toHaveLength(0);
  });

  it('templates are scoped per team', async () => {
    const owner = await register('tpl-own6@test.dev');
    const teamA = await getFirstTeamId(owner);
    const teamB = await createTeam(owner, 'Second team');
    const projectA = await createProject(owner, 'A', teamA);
    const projectB = await createProject(owner, 'B', teamB);
    await saveTemplate(owner, projectA, 'Team A tpl');
    await saveTemplate(owner, projectB, 'Team B tpl');

    const list = await request(app)
      .get('/api/v1/templates')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.body.templates).toHaveLength(2);
    const names = list.body.templates.map((t: { name: string }) => t.name).sort();
    expect(names).toEqual(['Team A tpl', 'Team B tpl']);
  });
});
