import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db/pool.js';
import { app, createProject, emailOf, getFirstTeamId, inviteUser, register, setTeamPlan, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

async function promoteToAdmin(email: string): Promise<void> {
  await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
}


async function projectCount(teamId: string): Promise<number> {
  const res = await pool.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM projects WHERE team_id = $1',
    [teamId],
  );
  return res.rows[0]!.n;
}

describe('plan quotas (ADR-043 Fase 1)', () => {
  let owner: string;
  let teamId: string;

  beforeEach(async () => {
    await resetDb();
    owner = await register('owner@test.dev');
    teamId = await getFirstTeamId(owner);
  });

  it('blocks the 4th project on a free team with PLAN_LIMIT details', async () => {
    for (let i = 0; i < 3; i++) await createProject(owner, `P${i}`, teamId);

    const res = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'P4', teamId });

    expect(res.status).toBe(402);
    expect((res.body as { error: { code: string; details: unknown } }).error.code).toBe('PLAN_LIMIT');
    expect((res.body as { error: { details: unknown } }).error.details).toMatchObject({
      resource: 'projects',
      limit: 3,
    });
    expect(await projectCount(teamId)).toBe(3);
  });

  it('allows unlimited projects once an admin sets the team to pro', async () => {
    const adminEmail = 'admin@test.dev';
    const admin = await register(adminEmail);
    await promoteToAdmin(adminEmail);
    for (let i = 0; i < 3; i++) await createProject(owner, `P${i}`, teamId);

    const patch = await request(app)
      .patch(`/api/v1/admin/teams/${teamId}/plan`)
      .set('Cookie', admin)
      .set('X-Forwarded-For', uniqueIp())
      .send({ plan: 'pro' });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ id: teamId, plan: 'pro' });

    const res = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'P4', teamId });
    expect(res.status).toBe(201);
    expect(await projectCount(teamId)).toBe(4);
  });

  it('rejects plan changes from non-admin users with 403', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/teams/${teamId}/plan`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ plan: 'pro' });
    expect(res.status).toBe(403);
  });

  it('blocks inviting a third member on a free team', async () => {
    const second = await register('second@test.dev');
    await inviteUser(owner, second, teamId, 'editor');

    const third = await register('third@test.dev');
    const invite = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: await emailOf(third), role: 'viewer' });

    expect(invite.status).toBe(402);
    expect(invite.body.error.code).toBe('PLAN_LIMIT');
    expect(invite.body.error.details).toMatchObject({ resource: 'members', limit: 2 });
  });

  it('blocks accepting a pending invitation once the team is full (race guard)', async () => {
    const late = await register('late@test.dev');
    const invite = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: await emailOf(late), role: 'viewer' });
    expect(invite.status).toBe(201);

    const filler = await register('filler@test.dev');
    await inviteUser(owner, filler, teamId, 'editor');

    const list = await request(app)
      .get('/api/v1/teams/invitations')
      .set('Cookie', late)
      .set('X-Forwarded-For', uniqueIp());
    const inv = (list.body.invitations as Array<{ id: string; teamId: string }>).find(
      (i) => i.teamId === teamId,
    );
    expect(inv).toBeDefined();

    const accept = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations/${inv!.id}/accept`)
      .set('Cookie', late);
    expect(accept.status).toBe(402);
    expect(accept.body.error.code).toBe('PLAN_LIMIT');
  });

  it('grandfathers existing projects after downgrade but blocks new ones', async () => {
    await setTeamPlan(teamId, 'pro');
    for (let i = 0; i < 4; i++) await createProject(owner, `P${i}`, teamId);
    await setTeamPlan(teamId, 'free');

    const list = await request(app)
      .get('/api/v1/projects')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(200);
    expect(await projectCount(teamId)).toBe(4);

    const res = await request(app)
      .post('/api/v1/projects')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'P5', teamId });
    expect(res.status).toBe(402);
  });

  it('exposes the plan in team payloads', async () => {
    const before = await request(app)
      .get('/api/v1/teams')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(before.body.teams[0].plan).toBe('free');

    await setTeamPlan(teamId, 'pro');
    const after = await request(app)
      .get('/api/v1/teams')
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(after.body.teams[0].plan).toBe('pro');
  });
});
