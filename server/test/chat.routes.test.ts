import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createProject, createTeam, inviteUser, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { emptyState } from '../src/schema/state.js';

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
    expect(unread.body.unread).toBe(1);

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
    expect(after.body.unread).toBe(0);

    const editorUnread = await request(app)
      .get(`/api/v1/teams/${teamId}/messages/unread`)
      .set('Cookie', editor)
      .set('X-Forwarded-For', uniqueIp());
    expect(editorUnread.body.unread).toBe(1);
  });

it('filters to the team when counting unread and excludes own messages', async () => {
    const owner = await register('multi@test.dev');
    const editor = await register('multi-editor@test.dev');
    const teamA = await createTeam(owner, 'A');
    const teamB = await createTeam(owner, 'B');
    await inviteUser(owner, editor, teamA, 'editor');
    await sendMessage(editor, teamA, 'a1');
    await sendMessage(owner, teamB, 'b1');

    const unreadA = await request(app)
      .get(`/api/v1/teams/${teamA}/messages/unread`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(unreadA.status).toBe(200);
    expect(unreadA.body.unread).toBe(1);

    const unreadB = await request(app)
      .get(`/api/v1/teams/${teamB}/messages/unread`)
      .set('Cookie', owner)
      .set('X-Forwarded-For', uniqueIp());
    expect(unreadB.status).toBe(200);
    expect(unreadB.body.unread).toBe(0);
  });

  it('resolves entity refs from team projects', async () => {
    const cookie = await register('refs@test.dev');
    const teamId = await createTeam(cookie, 'Refs');
    const projectId = await createProject(cookie, 'Refs project', teamId);

    const t1 = '11111111-1111-4111-8111-111111111111';
    const i1 = '22222222-2222-4222-8222-222222222222';
    const wb1 = '33333333-3333-4333-8333-333333333333';
    const state = {
      ...emptyState,
      tasks: [{ id: t1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', title: 'Build login', status: 'todo', priority: 'medium' }],
      issues: [{ id: i1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', title: 'Flaky test', severity: 'medium', status: 'open' }],
      whiteboards: [{ id: wb1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', name: 'Roadmap', description: '', elements: [] }],
    };
    const seed = await request(app)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state, version: 1 });
    expect(seed.status).toBe(200);

    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/messages/resolve-refs`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ refs: [{ entity: 'tasks', entityId: t1 }, { entity: 'issues', entityId: i1 }, { entity: 'whiteboards', entityId: wb1 }] });
    expect(res.status).toBe(200);
    expect(res.body.refs).toEqual([
      { entity: 'tasks', entityId: t1, projectId, title: 'Build login' },
      { entity: 'issues', entityId: i1, projectId, title: 'Flaky test' },
      { entity: 'whiteboards', entityId: wb1, projectId, title: 'Roadmap' },
    ]);
  });

  it('returns null titles for unknown refs', async () => {
    const cookie = await register('refs2@test.dev');
    const teamId = await createTeam(cookie, 'Refs2');
    await createProject(cookie, 'Empty project', teamId);

    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/messages/resolve-refs`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ refs: [{ entity: 'tasks', entityId: '44444444-4444-4444-8444-444444444444' }] });
    expect(res.status).toBe(200);
    expect(res.body.refs[0]).toEqual({
      entity: 'tasks',
      entityId: '44444444-4444-4444-8444-444444444444',
      projectId: null,
      title: null,
    });
  });

  it('derives titles for relations and schema versions', async () => {
    const cookie = await register('refs3@test.dev');
    const teamId = await createTeam(cookie, 'Refs3');
    const projectId = await createProject(cookie, 'Schema project', teamId);

    const tb1 = '55555555-5555-4555-8555-555555555555';
    const tb2 = '66666666-6666-4666-8666-666666666666';
    const r1 = '77777777-7777-4777-8777-777777777777';
    const sv1 = '88888888-8888-4888-8888-888888888888';
    const col1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const col2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const state = {
      ...emptyState,
      tables: [{ id: tb1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', name: 'users' }, { id: tb2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', name: 'projects' }],
      relations: [{ id: r1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', fromTableId: tb1, fromColumnId: col1, toTableId: tb2, toColumnId: col2, cardinality: '1:N', onDelete: 'cascade' }],
      schemaVersions: [{ id: sv1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', version: 'v0.1.0', notes: '', appliedAt: '2026-01-01T00:00:00.000Z' }],
    };
    const seed = await request(app)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state, version: 1 });
    expect(seed.status).toBe(200);

    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/messages/resolve-refs`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ refs: [{ entity: 'relations', entityId: r1 }, { entity: 'schemaVersions', entityId: sv1 }] });
    expect(res.status).toBe(200);
    expect(res.body.refs[0].title).toBe(`users.${col1} → projects.${col2}`);
    expect(res.body.refs[1].title).toBe('v0.1.0');
  });

  it('rejects invalid resolve-refs payloads', async () => {
    const cookie = await register('refs4@test.dev');
    const teamId = await createTeam(cookie, 'Refs4');

    const empty = await request(app)
      .post(`/api/v1/teams/${teamId}/messages/resolve-refs`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ refs: [] });
    expect(empty.status).toBe(400);

    const bogus = await request(app)
      .post(`/api/v1/teams/${teamId}/messages/resolve-refs`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ refs: [{ entity: 'bogus', entityId: '11111111-1111-4111-8111-111111111111' }] });
    expect(bogus.status).toBe(400);
  });

  it('rejects resolve-refs from non-members', async () => {
    const owner = await register('refs5@test.dev');
    const outsider = await register('refs6@test.dev');
    const teamId = await createTeam(owner, 'Refs5');

    const res = await request(app)
      .post(`/api/v1/teams/${teamId}/messages/resolve-refs`)
      .set('Cookie', outsider)
      .set('X-Forwarded-For', uniqueIp())
      .send({ refs: [{ entity: 'tasks', entityId: '11111111-1111-4111-8111-111111111111' }] });
    expect(res.status).toBe(404);
  });
});