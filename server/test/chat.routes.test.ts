import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createTeam, inviteUser, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

async function sendMessage(
  cookie: string,
  teamId: string,
  content: string,
  refs: unknown[] = [],
) {
  return request(app)
    .post(`/api/v1/teams/${teamId}/messages`)
    .set('Cookie', cookie)
    .set('X-Forwarded-For', uniqueIp())
    .send({ content, refs });
}

describe('chat routes', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('posts and lists messages with keyset pagination', async () => {
    const cookie = await register('chat@test.dev');
    const teamId = await createTeam(cookie, 'Chat');

    const sent = await sendMessage(cookie, teamId, 'hello world');
    expect(sent.status).toBe(201);
    expect(sent.body.message.content).toBe('hello world');
    expect(sent.body.message.authorName).toBe('chat@test.dev');

    await sendMessage(cookie, teamId, 'second');
    await sendMessage(cookie, teamId, 'third');

    const list = await request(app)
      .get(`/api/v1/teams/${teamId}/messages`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(200);
    expect(list.body.messages.map((m: { content: string }) => m.content)).toEqual([
      'third',
      'second',
      'hello world',
    ]);
    expect(list.body.nextCursor).toBeNull();

    const cursor = list.body.messages[1]?.createdAt as string;
    const page = await request(app)
      .get(`/api/v1/teams/${teamId}/messages?before=${encodeURIComponent(cursor)}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(page.status).toBe(200);
    expect(page.body.messages.map((m: { content: string }) => m.content)).toEqual([
      'hello world',
    ]);
  });

  it('rejects invalid message data', async () => {
    const cookie = await register('chat2@test.dev');
    const teamId = await createTeam(cookie);

    const empty = await sendMessage(cookie, teamId, '   ');
    expect(empty.status).toBe(400);

    const badRef = await sendMessage(cookie, teamId, 'ok', [
      { entity: 'nope', entityId: 'not-a-uuid' },
    ]);
    expect(badRef.status).toBe(400);

    const tooMany = await sendMessage(
      cookie,
      teamId,
      'ok',
      Array.from({ length: 11 }, () => ({
        entity: 'tasks',
        entityId: '11111111-1111-4111-8111-111111111111',
      })),
    );
    expect(tooMany.status).toBe(400);
  });

  it('rejects messages from non-members', async () => {
    const owner = await register('owner@test.dev');
    const outsider = await register('outsider@test.dev');
    const teamId = await createTeam(owner);

    const sent = await sendMessage(outsider, teamId, 'nope');
    expect(sent.status).toBe(404);

    const list = await request(app)
      .get(`/api/v1/teams/${teamId}/messages`)
      .set('Cookie', outsider)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(404);
  });

  it('deletes own messages as a member and others as admin', async () => {
    const owner = await register('owner@test.dev');
    const editor = await register('editor@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, editor, teamId, 'editor');

    const sent = await sendMessage(editor, teamId, 'mine');
    const messageId = sent.body.message.id as string;

    const own = await request(app)
      .delete(`/api/v1/teams/${teamId}/messages/${messageId}`)
      .set('Cookie', editor)
      .set('X-Forwarded-For', uniqueIp());
    expect(own.status).toBe(200);

    const second = await sendMessage(owner, teamId, 'admin owns');
    const denied = await request(app)
      .delete(`/api/v1/teams/${teamId}/messages/${second.body.message.id}`)
      .set('Cookie', editor)
      .set('X-Forwarded-For', uniqueIp());
    expect(denied.status).toBe(403);

    const third = await sendMessage(editor, teamId, 'admin deletes');
    const admin = await request(app)
      .delete(`/api/v1/teams/${teamId}/messages/${third.body.message.id}`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(admin.status).toBe(200);
  });

  it('reports unread counts and records read state', async () => {
    const owner = await register('owner@test.dev');
    const editor = await register('editor@test.dev');
    const teamId = await createTeam(owner);
    await inviteUser(owner, editor, teamId, 'editor');

    await sendMessage(editor, teamId, 'hi');
    const second = await sendMessage(owner, teamId, 'there');

    const unread = await request(app)
      .get(`/api/v1/teams/${teamId}/messages/unread`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(unread.status).toBe(200);
    expect(unread.body.unread).toBe(2);

    const read = await request(app)
      .put(`/api/v1/teams/${teamId}/messages/read`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp())
      .send({ lastReadAt: second.body.message.createdAt });
    expect(read.status).toBe(200);

    const after = await request(app)
      .get(`/api/v1/teams/${teamId}/messages/unread`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(after.body.unread).toBe(1);

    const editorUnread = await request(app)
      .get(`/api/v1/teams/${teamId}/messages/unread`)
      .set('Cookie', editor)
      .set('X-Forwarded-For', uniqueIp());
    expect(editorUnread.body.unread).toBe(2);
  });

  it('filters to the team when counting unread', async () => {
    const owner = await register('multi@test.dev');
    const teamA = await createTeam(owner, 'A');
    const teamB = await createTeam(owner, 'B');
    await sendMessage(owner, teamA, 'a1');
    await sendMessage(owner, teamB, 'b1');

    const unreadA = await request(app)
      .get(`/api/v1/teams/${teamA}/messages/unread`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(unreadA.body.unread).toBe(1);
  });
});