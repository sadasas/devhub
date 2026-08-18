import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createTeam, emailOf, inviteUser, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

async function memberRoles(teamId: string, cookie: string) {
  const res = await request(app)
    .get(`/api/v1/teams/${teamId}/members`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp());
  expect(res.status).toBe(200);
  return res.body.members as Array<{ id: string; email: string; displayName: string; role: string }>;
}

describe('teams routes', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a team with the creator as owner', async () => {
    const cookie = await register('creator@test.dev');
    const teamId = await createTeam(cookie, 'Engineering');
    const res = await request(app)
      .get(`/api/v1/teams/${teamId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.team.name).toBe('Engineering');
    expect(res.body.team.role).toBe('owner');
    expect(res.body.team.memberCount).toBe(1);
  });

  it('hides teams from non-members', async () => {
    const owner = await register('owner@test.dev');
    const outsider = await register('outsider@test.dev');
    const teamId = await createTeam(owner);
    const res = await request(app)
      .get(`/api/v1/teams/${teamId}`)
      .set('Cookie', outsider)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(404);
  });

  it('renames a team as admin and rejects viewers', async () => {
    const owner = await register('owner@test.dev');
    const viewer = await register('viewer@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, viewer, teamId, 'viewer');

    const denied = await request(app)
      .patch(`/api/v1/teams/${teamId}`)
      .set('Cookie', viewer)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Nope' });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .patch(`/api/v1/teams/${teamId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ name: 'Renamed' });
    expect(ok.status).toBe(200);
  });

  it('deletes a team as owner only', async () => {
    const owner = await register('owner@test.dev');
    const admin = await register('admin@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, admin, teamId, 'admin');

    const denied = await request(app)
      .delete(`/api/v1/teams/${teamId}`)
      .set('Cookie', admin)
      .set('X-Forwarded-For', uniqueIp());
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .delete(`/api/v1/teams/${teamId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(ok.status).toBe(200);
  });

  it('lists members with their roles', async () => {
    const owner = await register('owner@test.dev');
    const editor = await register('editor@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, editor, teamId, 'editor');

    const members = await memberRoles(teamId, owner);
    expect(members).toHaveLength(2);
    expect(members.find((m) => m.email === 'editor@test.dev')?.role).toBe('editor');
    expect(members.find((m) => m.email === 'owner@test.dev')?.role).toBe('owner');
    expect(members[0]?.displayName).toBe('');
  });

  it('rejects invitations without an existing account', async () => {
    const owner = await register('owner@test.dev');
    const teamId = await createTeam(owner);
    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'ghost@nowhere.dev', role: 'editor' });
    expect(res.status).toBe(400);
  });

  it('blocks self-invites and duplicate pending invites', async () => {
    const owner = await register('owner@test.dev');
    const member = await register('member@test.dev');
    const teamId = await createTeam(owner);

    const self = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'owner@test.dev', role: 'editor' });
    expect(self.status).toBe(400);

    await inviteUser(owner, member, teamId, 'editor');
    const dup = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'member@test.dev', role: 'viewer' });
    expect(dup.status).toBe(400);
  });

  it('lists pending invitations for admins only', async () => {
    const owner = await register('owner@test.dev');
    await register('member@test.dev');
    const teamId = await createTeam(owner);

    await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'member@test.dev', role: 'viewer' });

    const adminList = await request(app)
      .get(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(adminList.status).toBe(200);
    expect(adminList.body.invitations).toHaveLength(1);
    expect(adminList.body.invitations[0].email).toBe('member@test.dev');
    expect(adminList.body.invitations[0].role).toBe('viewer');
  });

  it('accepts an invitation and removes it from pending', async () => {
    const owner = await register('owner@test.dev');
    const member = await register('member@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, member, teamId, 'admin');

    const members = await memberRoles(teamId, owner);
    expect(members.find((m) => m.email === 'member@test.dev')?.role).toBe('admin');

    const pending = await request(app)
      .get(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(pending.body.invitations).toHaveLength(0);
  });

  it('lets the invitee decline an invitation', async () => {
    const owner = await register('owner@test.dev');
    const member = await register('member@test.dev');
    const teamId = await createTeam(owner);
    const email = await emailOf(member);

    const invite = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ email, role: 'viewer' });
    const invitationId = invite.body.invitation.id as string;

    const decline = await request(app)
      .delete(`/api/v1/teams/${teamId}/invitations/${invitationId}`)
      .set('Cookie', member);
    expect(decline.status).toBe(200);

    const pending = await request(app)
      .get(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(pending.body.invitations).toHaveLength(0);

    const members = await memberRoles(teamId, owner);
    expect(members).toHaveLength(1);
  });

  it('lets an admin withdraw a pending invitation', async () => {
    const owner = await register('owner@test.dev');
    const admin = await register('admin@test.dev');
    await register('member@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, admin, teamId, 'admin');

    const invite = await request(app)
      .post(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ email: 'member@test.dev', role: 'viewer' });
    const invitationId = invite.body.invitation.id as string;

    const withdrawn = await request(app)
      .delete(`/api/v1/teams/${teamId}/invitations/${invitationId}`)
      .set('Cookie', admin)
      .set('X-Forwarded-For', uniqueIp());
    expect(withdrawn.status).toBe(200);

    const pending = await request(app)
      .get(`/api/v1/teams/${teamId}/invitations`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(pending.body.invitations).toHaveLength(0);
  });

  it('changes member roles as admin and protects the owner row', async () => {
    const owner = await register('owner@test.dev');
    const member = await register('member@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, member, teamId, 'editor');

    const members = await memberRoles(teamId, owner);
    const memberId = members.find((m) => m.email === 'member@test.dev')!.id;
    const ownerId = members.find((m) => m.email === 'owner@test.dev')!.id;

    const change = await request(app)
      .patch(`/api/v1/teams/${teamId}/members/${memberId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ role: 'viewer' });
    expect(change.status).toBe(200);

    const blocked = await request(app)
      .patch(`/api/v1/teams/${teamId}/members/${ownerId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ role: 'admin' });
    expect(blocked.status).toBe(400);
  });

  it('rejects role changes from editors', async () => {
    const owner = await register('owner@test.dev');
    const editor = await register('editor@test.dev');
    const member = await register('member@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, editor, teamId, 'editor');
    await inviteUser(owner, member, teamId, 'viewer');

    const members = await memberRoles(teamId, owner);
    const memberId = members.find((m) => m.email === 'member@test.dev')!.id;

    const res = await request(app)
      .patch(`/api/v1/teams/${teamId}/members/${memberId}`)
      .set('Cookie', editor)
      .set('X-Forwarded-For', uniqueIp())
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('transfers ownership and demotes the old owner to admin', async () => {
    const owner = await register('owner@test.dev');
    const member = await register('member@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, member, teamId, 'admin');

    const members = await memberRoles(teamId, owner);
    const memberId = members.find((m) => m.email === 'member@test.dev')!.id;

    const transfer = await request(app)
      .patch(`/api/v1/teams/${teamId}/members/${memberId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ role: 'owner' });
    expect(transfer.status).toBe(200);

    const after = await memberRoles(teamId, owner);
    expect(after.find((m) => m.email === 'member@test.dev')?.role).toBe('owner');
    expect(after.find((m) => m.email === 'owner@test.dev')?.role).toBe('admin');
  });

  it('prevents non-owners from transferring ownership', async () => {
    const owner = await register('owner@test.dev');
    const admin = await register('admin@test.dev');
    const member = await register('member@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, admin, teamId, 'admin');
    await inviteUser(owner, member, teamId, 'viewer');

    const members = await memberRoles(teamId, admin);
    const memberId = members.find((m) => m.email === 'member@test.dev')!.id;

    const res = await request(app)
      .patch(`/api/v1/teams/${teamId}/members/${memberId}`)
      .set('Cookie', admin)
      .set('X-Forwarded-For', uniqueIp())
      .send({ role: 'owner' });
    expect(res.status).toBe(403);
  });

  it('removes members as admin and protects the owner', async () => {
    const owner = await register('owner@test.dev');
    const member = await register('member@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, member, teamId, 'viewer');

    const members = await memberRoles(teamId, owner);
    const memberId = members.find((m) => m.email === 'member@test.dev')!.id;
    const ownerId = members.find((m) => m.email === 'owner@test.dev')!.id;

    const blocked = await request(app)
      .delete(`/api/v1/teams/${teamId}/members/${ownerId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(blocked.status).toBe(400);

    const removed = await request(app)
      .delete(`/api/v1/teams/${teamId}/members/${memberId}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(removed.status).toBe(200);

    const after = await memberRoles(teamId, owner);
    expect(after).toHaveLength(1);
  });

  it('lets a member leave on their own', async () => {
    const owner = await register('owner@test.dev');
    const member = await register('member@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, member, teamId, 'viewer');

    const members = await memberRoles(teamId, owner);
    const memberId = members.find((m) => m.email === 'member@test.dev')!.id;

    const leave = await request(app)
      .delete(`/api/v1/teams/${teamId}/members/${memberId}`)
      .set('Cookie', member)
      .set('X-Forwarded-For', uniqueIp());
    expect(leave.status).toBe(200);

    const res = await request(app)
      .get(`/api/v1/teams/${teamId}`)
      .set('Cookie', member)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(404);
  });

  it('returns 404 for invalid uuid params instead of 500', async () => {
    const cookie = await register('badid@test.dev');

    const team = await request(app)
      .get('/api/v1/teams/not-a-uuid')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(team.status).toBe(404);

    const teamId = await createTeam(cookie);
    const member = await request(app)
      .delete(`/api/v1/teams/${teamId}/members/not-a-uuid`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(member.status).toBe(404);

    const invite = await request(app)
      .delete(`/api/v1/teams/${teamId}/invitations/not-a-uuid`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(invite.status).toBe(404);
  });
});
