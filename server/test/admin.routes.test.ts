import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db/pool.js';
import { app, createProject, getFirstTeamId, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

async function promoteToAdmin(email: string): Promise<void> {
  await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
}

async function userIdOf(email: string): Promise<string> {
  const res = await pool.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
  return res.rows[0]!.id;
}

describe('admin routes', () => {
  let adminCookie: string;
  let userCookie: string;

  beforeEach(async () => {
    await resetDb();
    const adminEmail = 'admin@test.dev';
    const userEmail = 'member@test.dev';
    const adminCookieRaw = await register(adminEmail);
    userCookie = await register(userEmail);
    await promoteToAdmin(adminEmail);
    adminCookie = adminCookieRaw;
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/admin/stats');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users with 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', userCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(403);
    expect((res.body as { error?: { code?: string } }).error?.code).toBe('FORBIDDEN');
  });

  it('exposes the global role through /auth/me', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect((res.body as { role?: string }).role).toBe('admin');

    const other = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', userCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect((other.body as { role?: string }).role).toBe('user');
  });

  it('returns platform stats for admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    const body = res.body as { users: number; teams: number; projects: number };
    expect(body.users).toBe(2);
    expect(body.teams).toBeGreaterThanOrEqual(2);
    expect(body.projects).toBe(0);
  });

  it('lists users with search and pagination', async () => {
    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    let body = res.body as { users: Array<{ email: string; role: string; teamCount: number }>; total: number };
    expect(body.total).toBe(2);
    expect(body.users).toHaveLength(2);

    const search = await request(app)
      .get('/api/v1/admin/users?query=member')
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp());
    body = search.body as typeof body;
    expect(body.total).toBe(1);
    expect(body.users[0]?.email).toBe('member@test.dev');
    expect(body.users[0]?.role).toBe('user');

    const paged = await request(app)
      .get('/api/v1/admin/users?limit=1&offset=1')
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp());
    body = paged.body as typeof body;
    expect(body.users).toHaveLength(1);
    expect(body.total).toBe(2);

    const invalid = await request(app)
      .get('/api/v1/admin/users?limit=9999')
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(invalid.status).toBe(400);
  });

  it('changes a user role and blocks self-demote', async () => {
    const targetId = await userIdOf('member@test.dev');
    const promote = await request(app)
      .patch(`/api/v1/admin/users/${targetId}/role`)
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ role: 'admin' });
    expect(promote.status).toBe(200);
    expect((promote.body as { role: string }).role).toBe('admin');

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', userCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect((me.body as { role?: string }).role).toBe('admin');

    const adminId = await userIdOf('admin@test.dev');
    const selfDemote = await request(app)
      .patch(`/api/v1/admin/users/${adminId}/role`)
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ role: 'user' });
    expect(selfDemote.status).toBe(409);

    const demote = await request(app)
      .patch(`/api/v1/admin/users/${targetId}/role`)
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ role: 'user' });
    expect(demote.status).toBe(200);

    const missing = await request(app)
      .patch('/api/v1/admin/users/00000000-0000-0000-0000-000000000000/role')
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ role: 'user' });
    expect(missing.status).toBe(404);

    const badRole = await request(app)
      .patch(`/api/v1/admin/users/${targetId}/role`)
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ role: 'owner' });
    expect(badRole.status).toBe(400);
  });

  it('lists teams and recent platform activity', async () => {
    const teamId = await getFirstTeamId(adminCookie);
    const projectId = await createProject(adminCookie, 'Admin test project', teamId);
    await pool.query(
      `INSERT INTO activity_log (project_id, entity, entity_id, action, author_id, author_name, summary)
       VALUES ($1, 'tasks', gen_random_uuid(), 'created', $2, 'admin@test.dev', 'created task "Demo"')`,
      [projectId, await userIdOf('admin@test.dev')],
    );

    const teamsRes = await request(app)
      .get('/api/v1/admin/teams')
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(teamsRes.status).toBe(200);
    const teams = (teamsRes.body as {
      teams: Array<{ id: string; name: string; plan: string; memberCount: number; projectCount: number }>;
    }).teams;
    expect(teams.length).toBeGreaterThanOrEqual(2);
    expect(teams[0]?.ownerEmail).toBeTruthy();
    // ADMIN-C1: field plan harus terkirim agar UI tidak menampilkan "Free" palsu
    expect(teams.every((t) => t.plan === 'free' || t.plan === 'pro')).toBe(true);

    await pool.query(
      `UPDATE teams SET plan = 'pro', plan_expires_at = now() + interval '30 days' WHERE id = $1`,
      [teamId],
    );
    const proRes = await request(app)
      .get('/api/v1/admin/teams')
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp());
    const proTeams = (proRes.body as { teams: Array<{ id: string; plan: string }> }).teams;
    expect(proTeams.find((t) => t.id === teamId)?.plan).toBe('pro');

    const activityRes = await request(app)
      .get('/api/v1/admin/stats/activity?range=7d')
      .set('Cookie', adminCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(activityRes.status).toBe(200);
    // Kontrak nyata: bare array bucket {date,label,count} (bukan {activity:[...]})
    const activity = activityRes.body as Array<{ date: string; label: string; count: number }>;
    expect(Array.isArray(activity)).toBe(true);
    expect(activity.length).toBeGreaterThan(0);
    const totalBuckets = activity.reduce((sum, b) => sum + (b.count ?? 0), 0);
    expect(totalBuckets).toBeGreaterThanOrEqual(1);
  });
});
