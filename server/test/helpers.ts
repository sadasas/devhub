import { expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();

let ipCounter = 0;
export function uniqueIp(): string {
  ipCounter += 1;
  return `192.0.2.${ipCounter % 255}`;
}

export async function register(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .set('X-Forwarded-For', uniqueIp())
    .send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  const cookie = (res.headers['set-cookie'] as unknown as string[] | undefined)?.[0];
  expect(cookie).toBeDefined();
  return cookie!.split(';')[0]!;
}

export async function emailOf(cookie: string): Promise<string> {
  const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
  expect(me.status).toBe(200);
  return (me.body as { email: string }).email;
}

export async function getFirstTeamId(cookie: string): Promise<string> {
  const res = await request(app)
    .get('/api/teams')
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  const teamId = (res.body.teams as Array<{ id: string }>)[0]?.id;
  expect(teamId).toBeDefined();
  return teamId!;
}

export async function createTeam(cookie: string, name = 'Test team'): Promise<string> {
  const res = await request(app)
    .post('/api/teams')
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ name });
  expect(res.status).toBe(201);
  return (res.body.team as { id: string }).id;
}

export async function createKey(cookie: string): Promise<string> {
  const res = await request(app)
    .post('/api/keys')
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({});
  expect(res.status).toBe(201);
  return res.body.key as string;
}

export async function createProject(cookie: string, name = 'Test project', teamId?: string): Promise<string> {
  const targetTeamId = teamId ?? (await getFirstTeamId(cookie));
  const res = await request(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ name, teamId: targetTeamId });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

export async function inviteUser(
  inviterCookie: string,
  inviteeCookie: string,
  teamId: string,
  role: 'admin' | 'editor' | 'viewer' = 'viewer',
): Promise<void> {
  const email = await emailOf(inviteeCookie);
  const invite = await request(app)
    .post(`/api/teams/${teamId}/invitations`)
    .set('Cookie', inviterCookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ email, role });
  expect(invite.status).toBe(201);
  const list = await request(app)
    .get('/api/teams/invitations')
    .set('Cookie', inviteeCookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(list.status).toBe(200);
  const inv = (list.body.invitations as Array<{ id: string; teamId: string }>).find(
    (i) => i.teamId === teamId,
  );
  expect(inv).toBeDefined();
  const accept = await request(app)
    .post(`/api/teams/${teamId}/invitations/${inv!.id}/accept`)
    .set('Cookie', inviteeCookie);
  expect(accept.status).toBe(200);
}
