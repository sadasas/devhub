import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { pool } from '../src/db/pool.js';
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
  expect(res.body.template.ownerId).toBeTruthy();
  expect(res.body.template.teamId).toBeUndefined();
  return (res.body.template as { id: string }).id;
}

describe('templates (owner-only)', () => {
  it('saves a template from a project and lists it for the owner only', async () => {
    const owner = await register('tpl-owner@gmail.com');
    const projectId = await createProject(owner, 'Source project');
    await seedState(owner, projectId);
    const templateId = await saveTemplate(owner, projectId);

    const list = await request(app)
      .get('/api/v1/templates')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(200);
    expect(list.body.templates).toHaveLength(1);
    expect(list.body.templates[0]).toMatchObject({ id: templateId, name: 'Sprint starter' });
    expect(list.body.templates[0].ownerId).toBeTruthy();
    expect(list.body.templates[0].teamId).toBeUndefined();
    expect(list.body.templates[0].teamName).toBeUndefined();

    const single = await request(app)
      .get(`/api/v1/templates/${templateId}`)
      .set('Cookie', owner);
    expect(single.status).toBe(200);
    expect(single.body.template.state.tasks).toHaveLength(1);
  });

  it('hides templates from teammates: list/get/update/delete are owner-only', async () => {
    const owner = await register('tpl-priv-owner@gmail.com');
    const mate = await register('tpl-priv-mate@gmail.com');
    const teamId = await getFirstTeamId(owner);
    await inviteUser(owner, mate, teamId, 'admin');
    const projectId = await createProject(owner, 'Source', teamId);
    await seedState(owner, projectId);
    const templateId = await saveTemplate(owner, projectId);

    const mateList = await request(app)
      .get('/api/v1/templates')
      .set('Cookie', mate)
      .set('X-Forwarded-For', uniqueIp());
    expect(mateList.status).toBe(200);
    expect(mateList.body.templates).toHaveLength(0);

    const mateGet = await request(app)
      .get(`/api/v1/templates/${templateId}`)
      .set('Cookie', mate);
    expect(mateGet.status).toBe(404);

    const matePatch = await request(app)
      .patch(`/api/v1/templates/${templateId}`)
      .set('Cookie', mate)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Hijacked' });
    expect(matePatch.status).toBe(404);

    const mateDelete = await request(app)
      .delete(`/api/v1/templates/${templateId}`)
      .set('Cookie', mate)
      .set('X-Forwarded-For', uniqueIp());
    expect(mateDelete.status).toBe(404);
  });

  it('owner can rename a template; empty patch is rejected', async () => {
    const owner = await register('tpl-rename@gmail.com');
    const projectId = await createProject(owner, 'Source');
    const templateId = await saveTemplate(owner, projectId, 'Old name');

    const patched = await request(app)
      .patch(`/api/v1/templates/${templateId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'New name', description: 'Fresh desc' });
    expect(patched.status).toBe(200);
    expect(patched.body.template).toMatchObject({ id: templateId, name: 'New name', description: 'Fresh desc' });

    const empty = await request(app)
      .patch(`/api/v1/templates/${templateId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({});
    expect(empty.status).toBe(400);
  });

  it('instantiates into a selectable target team (cross-team)', async () => {
    const owner = await register('tpl-cross@gmail.com');
    const teamA = await getFirstTeamId(owner);
    const teamB = await createTeam(owner, 'Second team');
    const projectA = await createProject(owner, 'A', teamA);
    await seedState(owner, projectA);
    const templateId = await saveTemplate(owner, projectA, 'Cross tpl');

    const res = await request(app)
      .post(`/api/v1/templates/${templateId}/instantiate`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ teamId: teamB, name: 'Sprint 42' });
    expect(res.status).toBe(201);
    const newProjectId = res.body.projectId as string;

    const state = await request(app)
      .get(`/api/v1/projects/${newProjectId}/state`)
      .set('Cookie', owner);
    expect(state.status).toBe(200);
    expect(state.body.state.tasks[0]?.title).toBe('Template task');

    const meta = await request(app)
      .get(`/api/v1/projects/${newProjectId}`)
      .set('Cookie', owner);
    expect(meta.status).toBe(200);
    expect(meta.body.teamId).toBe(teamB);
  });

  it('instantiate requires a team the owner belongs to', async () => {
    const owner = await register('tpl-noteam@gmail.com');
    const outsider = await register('tpl-noteam-out@gmail.com');
    const outsiderTeam = await getFirstTeamId(outsider);
    const projectId = await createProject(owner, 'Source');
    await seedState(owner, projectId);
    const templateId = await saveTemplate(owner, projectId);

    const missing = await request(app)
      .post(`/api/v1/templates/${templateId}/instantiate`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ teamId: outsiderTeam });
    expect(missing.status).toBe(404);
  });

  it('non-owner cannot instantiate someone else template (404)', async () => {
    const owner = await register('tpl-inst-own@gmail.com');
    const other = await register('tpl-inst-other@gmail.com');
    const otherTeam = await getFirstTeamId(other);
    const projectId = await createProject(owner, 'Source');
    await seedState(owner, projectId);
    const templateId = await saveTemplate(owner, projectId);

    const res = await request(app)
      .post(`/api/v1/templates/${templateId}/instantiate`)
      .set('Cookie', other)
      .set('X-Forwarded-For', uniqueIp())
      .send({ teamId: otherTeam });
    expect(res.status).toBe(404);
  });

  it('non-member cannot save a template from a project', async () => {
    const owner = await register('tpl-own2@gmail.com');
    const outsider = await register('tpl-outs@gmail.com');
    const projectId = await createProject(owner, 'Private source');
    const res = await request(app)
      .post('/api/v1/templates')
      .set('Cookie', outsider)
      .set('X-Forwarded-For', uniqueIp())
      .send({ projectId, name: 'Nope' });
    expect(res.status).toBe(404);
  });

  it('viewer cannot save a template', async () => {
    const owner = await register('tpl-own3@gmail.com');
    const viewer = await register('tpl-view@gmail.com');
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

  it('viewer cannot instantiate into their read-only team (403), owner can', async () => {
    const owner = await register('tpl-own4@gmail.com');
    const viewer = await register('tpl-view2@gmail.com');
    const teamId = await getFirstTeamId(owner);
    await inviteUser(owner, viewer, teamId, 'viewer');
    // Viewer owns a personal template from their own workspace.
    const viewerTeam = await createTeam(viewer, 'Viewer workspace');
    const viewerProject = await createProject(viewer, 'Viewer source', viewerTeam);
    await seedState(viewer, viewerProject);
    const viewerTemplate = await saveTemplate(viewer, viewerProject);

    const denied = await request(app)
      .post(`/api/v1/templates/${viewerTemplate}/instantiate`)
      .set('Cookie', viewer)
      .set('X-Forwarded-For', uniqueIp())
      .send({ teamId });
    expect(denied.status).toBe(403);

    const ownerProject = await createProject(owner, 'Source', teamId);
    await seedState(owner, ownerProject);
    const ownerTemplate = await saveTemplate(owner, ownerProject);
    const allowed = await request(app)
      .post(`/api/v1/templates/${ownerTemplate}/instantiate`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ teamId });
    expect(allowed.status).toBe(201);
  });

  it('owner deletes their template; teammate delete is 404', async () => {
    const owner = await register('tpl-own5@gmail.com');
    const editor = await register('tpl-editor@gmail.com');
    const teamId = await getFirstTeamId(owner);
    await inviteUser(owner, editor, teamId, 'editor');
    const projectId = await createProject(owner, 'Source', teamId);
    const templateId = await saveTemplate(owner, projectId);

    const denied = await request(app)
      .delete(`/api/v1/templates/${templateId}`)
      .set('Cookie', editor)
      .set('X-Forwarded-For', uniqueIp());
    expect(denied.status).toBe(404);

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

  it('migration 036 maps team templates to owners and drops team_id', async () => {
    // Schema assertion: owner_id exists and is NOT NULL, team_id is gone.
    const columns = await pool.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'project_templates'`,
    );
    const names = new Set(columns.rows.map((r) => r.column_name));
    expect(names.has('owner_id')).toBe(true);
    expect(names.has('team_id')).toBe(false);
    expect(columns.rows.find((r) => r.column_name === 'owner_id')?.is_nullable).toBe('NO');

    const index = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'project_templates'`,
    );
    const indexNames = index.rows.map((r) => r.indexname);
    expect(indexNames).toContain('idx_project_templates_owner_id');
    expect(indexNames).not.toContain('idx_project_templates_team_id');

    // Mapping rules are documented in the migration file itself.
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const sql = await readFile(path.join(dir, '..', 'src', 'db', 'migrations', '036_templates_owner.sql'), 'utf8');
    expect(sql).toMatch(/owner_id = created_by/);
    expect(sql).toMatch(/oldest member/i);
    expect(sql).toMatch(/teams\.created_by/);
    expect(sql).toMatch(/DROP COLUMN IF EXISTS team_id/);
  });
});
