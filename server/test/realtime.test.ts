import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { WebSocket, type RawData } from 'ws';
import { createRealtimeServer, WS_CLOSE, WS_PATH, type RealtimeServer } from '../src/modules/realtime/handlers/ws-server.js';
import { RoomRegistry } from '../src/modules/realtime/infrastructure/rooms.js';
import { attachRoomRegistry } from '../src/modules/realtime/infrastructure/broadcast.js';
import { app, createProject, createTeam, getFirstTeamId, inviteUser, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';

let httpServer: Server;
let realtime: RealtimeServer;
let port: number;
const rooms = new RoomRegistry();

beforeAll(async () => {
  await resetDb();
  attachRoomRegistry(rooms);
  httpServer = createServer(app);
  realtime = createRealtimeServer(httpServer, rooms);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterAll(() => {
  realtime.close();
  httpServer.close();
});

describe('RoomRegistry', () => {
  it('tracks members per room, leaveAll removes everywhere, broadcast skips except', () => {
    const registry = new RoomRegistry();
    const sent: string[] = [];
    const make = () =>
      ({
        OPEN: 1,
        readyState: 1,
        send: (data: string) => {
          sent.push(data);
        },
      }) as unknown as WebSocket;

    const a = make();
    const b = make();
    expect(registry.size('project:p1')).toBe(0);

    registry.join('project:p1', a);
    registry.join('project:p1', b);
    registry.join('project:p2', a);
    expect(registry.size('project:p1')).toBe(2);
    expect(registry.size('project:p2')).toBe(1);

    registry.leave('project:p1', a);
    expect(registry.size('project:p1')).toBe(1);

    registry.leaveAll(a);
    expect(registry.size('project:p2')).toBe(0);

    registry.join('project:p1', a);
    registry.join('project:p1', b);
    registry.broadcast('project:p1', { n: 1 });
    expect(sent).toHaveLength(2);
    registry.broadcast('project:p1', { n: 2 }, a);
    expect(sent).toHaveLength(3);
  });
});

describe('realtime WS server', () => {
  function openWs(cookie?: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}${WS_PATH}`, {
        headers: cookie ? { Cookie: cookie } : undefined,
      });
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  // Default timeout cukup longgar: presence di-debounce 1s (audit 2026-08b,
  // REALTIME-1) dan suite berjalan paralel — 6s menghindari flake timing.
  function nextMessage(ws: WebSocket, timeoutMs = 6000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.off('message', onMessage);
        reject(new Error('timed out waiting for ws message'));
      }, timeoutMs);
      const onMessage = (data: RawData) => {
        clearTimeout(timer);
        resolve(JSON.parse(data.toString()) as Record<string, unknown>);
      };
      ws.on('message', onMessage);
    });
  }

  function nextOfType(ws: WebSocket, type: string, timeoutMs = 6000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.off('message', onMessage);
        reject(new Error(`timed out waiting for ws message type ${type}`));
      }, timeoutMs);
      const onMessage = (data: RawData) => {
        let msg: unknown;
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }
        if (typeof msg === 'object' && msg !== null && (msg as { type?: unknown }).type === type) {
          clearTimeout(timer);
          ws.off('message', onMessage);
          resolve(msg as Record<string, unknown>);
        }
      };
      ws.on('message', onMessage);
    });
  }

  function waitClose(ws: WebSocket, timeoutMs = 3000): Promise<{ code: number }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for close')), timeoutMs);
      ws.once('close', (code) => {
        clearTimeout(timer);
        resolve({ code });
      });
    });
  }

  it('closes the connection without a session cookie (4001)', async () => {
    const ws = await openWs();
    const closed = await waitClose(ws);
    expect(closed.code).toBe(WS_CLOSE.UNAUTHORIZED);
  });

  it('closes the connection with a tampered token (4001)', async () => {
    const ws = await openWs('devhub_session=tampered-token');
    const closed = await waitClose(ws);
    expect(closed.code).toBe(WS_CLOSE.UNAUTHORIZED);
  });

  it('greets an authenticated user and joins a project room', async () => {
    const cookie = await register(`ws-join-${uniqueIp()}@test.dev`);
    const projectId = await createProject(cookie, 'WS join');

    const ws = await openWs(cookie);
    const hello = await nextMessage(ws);
    expect(hello.type).toBe('hello');
    expect(hello.userId).toEqual(expect.any(String));

    ws.send(JSON.stringify({ type: 'join', projectId }));
    const joined = await nextMessage(ws);
    expect(joined.type).toBe('joined');
    expect(joined.projectId).toBe(projectId);
    expect(['owner', 'admin', 'editor', 'viewer']).toContain(joined.role);
    expect(joined.teamId).toBeDefined();
    expect(rooms.size(`project:${projectId}`)).toBe(1);

    ws.close();
    await waitClose(ws);
  });

  it('rejects a non-member join with an error frame and keeps the connection open', async () => {
    const ownerCookie = await register(`ws-owner-${uniqueIp()}@test.dev`);
    const outsiderCookie = await register(`ws-outsider-${uniqueIp()}@test.dev`);
    const projectId = await createProject(ownerCookie, 'WS private');

    const ws = await openWs(outsiderCookie);
    await nextMessage(ws);

    ws.send(JSON.stringify({ type: 'join', projectId }));
    const error = await nextMessage(ws);
    expect(error.type).toBe('error');
    expect(error.code).toBe(403);
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
    await waitClose(ws);
  });

  it('answers ping with pong', async () => {
    const cookie = await register(`ws-ping-${uniqueIp()}@test.dev`);
    const ws = await openWs(cookie);
    await nextMessage(ws);

    ws.send(JSON.stringify({ type: 'ping' }));
    const pong = await nextMessage(ws);
    expect(pong.type).toBe('pong');

    ws.close();
    await waitClose(ws);
  });

  it('responds left when leaving a room and removes the socket from the registry', async () => {
    const cookie = await register(`ws-leave-${uniqueIp()}@test.dev`);
    const projectId = await createProject(cookie, 'WS leave');

    const ws = await openWs(cookie);
    await nextMessage(ws);
    ws.send(JSON.stringify({ type: 'join', projectId }));
    await nextMessage(ws);
    expect(rooms.size(`project:${projectId}`)).toBe(1);

    ws.send(JSON.stringify({ type: 'leave' }));
    const left = await nextMessage(ws);
    expect(left.type).toBe('left');
    expect(rooms.size(`project:${projectId}`)).toBe(0);

    ws.send(JSON.stringify({ type: 'join', projectId }));
    const rejoined = await nextOfType(ws, 'joined');
    expect(rejoined.type).toBe('joined');
    expect(rejoined.projectId).toBe(projectId);
    expect(rooms.size(`project:${projectId}`)).toBe(1);

    ws.close();
    await waitClose(ws);
  });

  it('broadcasts presence to room members when someone joins', async () => {
    const ownerCookie = await register(`ws-pr1-${uniqueIp()}@test.dev`);
    const memberCookie = await register(`ws-pr2-${uniqueIp()}@test.dev`);
    const teamId = await getFirstTeamId(ownerCookie);
    await inviteUser(ownerCookie, memberCookie, teamId);
    const projectId = await createProject(ownerCookie, 'WS presence', teamId);

    const wsA = await openWs(ownerCookie);
    await nextMessage(wsA);
    const joinedAPromise = nextOfType(wsA, 'joined');
    const presence1Promise = nextOfType(wsA, 'presence');
    wsA.send(JSON.stringify({ type: 'join', projectId }));

    await joinedAPromise;
    const presence1 = await presence1Promise;
    expect(presence1.type).toBe('presence');
    const users1 = presence1.users as Array<{ userId: string; name: string }>;
    expect(users1).toHaveLength(1);
    expect(users1[0]).toMatchObject({ userId: expect.any(String) });

    const wsB = await openWs(memberCookie);
    await nextMessage(wsB);
    const joinedBPromise = nextOfType(wsB, 'joined');
    const presenceBPromise = nextOfType(wsB, 'presence');
    const presenceA2Promise = nextOfType(wsA, 'presence');
    wsB.send(JSON.stringify({ type: 'join', projectId }));

    await joinedBPromise;
    const presenceB = await presenceBPromise;
    expect(presenceB.type).toBe('presence');
    expect(presenceB.users as unknown[]).toHaveLength(2);

    const presenceA2 = await presenceA2Promise;
    expect(presenceA2.type).toBe('presence');
    expect(presenceA2.users as unknown[]).toHaveLength(2);

    wsA.close();
    wsB.close();
    const [ca, cb] = await Promise.allSettled([waitClose(wsA), waitClose(wsB)]);
    expect(ca.status).toBe('fulfilled');
    expect(cb.status).toBe('fulfilled');
  });

  it('broadcasts presence updates when a member leaves or disconnects', async () => {
    const ownerCookie = await register(`ws-pr3-${uniqueIp()}@test.dev`);
    const memberCookie = await register(`ws-pr4-${uniqueIp()}@test.dev`);
    const teamId = await getFirstTeamId(ownerCookie);
    await inviteUser(ownerCookie, memberCookie, teamId);
    const projectId = await createProject(ownerCookie, 'WS presence 2', teamId);

    const wsA = await openWs(ownerCookie);
    await nextMessage(wsA);
    const joinedAPromise = nextOfType(wsA, 'joined');
    const presence1Promise = nextOfType(wsA, 'presence');
    wsA.send(JSON.stringify({ type: 'join', projectId }));

    await joinedAPromise;
    await presence1Promise;

    const wsB = await openWs(memberCookie);
    await nextMessage(wsB);
    const joinedBPromise = nextOfType(wsB, 'joined');
    const presenceBPromise = nextOfType(wsB, 'presence');
    const presenceA2Promise = nextOfType(wsA, 'presence');
    wsB.send(JSON.stringify({ type: 'join', projectId }));

    await joinedBPromise;
    await presenceBPromise;
    await presenceA2Promise;

    wsB.close();
    await waitClose(wsB);

    const presence = await nextOfType(wsA, 'presence');
    expect(presence.type).toBe('presence');
    expect(presence.users as unknown[]).toHaveLength(1);

    wsA.close();
    await waitClose(wsA);
  });

  it('tracks multiple sockets of the same user in one room', async () => {
    const cookie = await register(`ws-multi-${uniqueIp()}@test.dev`);
    const projectId = await createProject(cookie, 'WS multi');

    const wsA = await openWs(cookie);
    await nextMessage(wsA);
    const joinedAPromise = nextOfType(wsA, 'joined');
    const presence1Promise = nextOfType(wsA, 'presence');
    wsA.send(JSON.stringify({ type: 'join', projectId }));
    await joinedAPromise;
    await presence1Promise;

    const wsB = await openWs(cookie);
    await nextMessage(wsB);
    const joinedBPromise = nextOfType(wsB, 'joined');
    const presenceBPromise = nextOfType(wsB, 'presence');
    const presenceA2Promise = nextOfType(wsA, 'presence');
    wsB.send(JSON.stringify({ type: 'join', projectId }));

    await joinedBPromise;
    const presenceB = await presenceBPromise;
    expect(presenceB.type).toBe('presence');
    // Dedup per user (audit 2026-08b, REALTIME-1): multi-tab = satu entri presence
    expect(presenceB.users as unknown[]).toHaveLength(1);

    const presenceA2 = await presenceA2Promise;
    expect(presenceA2.users as unknown[]).toHaveLength(1);
    expect(rooms.size(`project:${projectId}`)).toBe(2);

    wsA.close();
    wsB.close();
    const [ca, cb] = await Promise.allSettled([waitClose(wsA), waitClose(wsB)]);
    expect(ca.status).toBe('fulfilled');
    expect(cb.status).toBe('fulfilled');
  });

  it('rebroadcasts presence when a member leaves via the leave frame', async () => {
    const ownerCookie = await register(`ws-lv1-${uniqueIp()}@test.dev`);
    const memberCookie = await register(`ws-lv2-${uniqueIp()}@test.dev`);
    const teamId = await getFirstTeamId(ownerCookie);
    await inviteUser(ownerCookie, memberCookie, teamId);
    const projectId = await createProject(ownerCookie, 'WS leave presence', teamId);

    const wsA = await openWs(ownerCookie);
    await nextMessage(wsA);
    const joinedAPromise = nextOfType(wsA, 'joined');
    const presence1Promise = nextOfType(wsA, 'presence');
    wsA.send(JSON.stringify({ type: 'join', projectId }));
    await joinedAPromise;
    await presence1Promise;

    const wsB = await openWs(memberCookie);
    await nextMessage(wsB);
    const joinedBPromise = nextOfType(wsB, 'joined');
    const presenceBPromise = nextOfType(wsB, 'presence');
    const presenceA2Promise = nextOfType(wsA, 'presence');
    wsB.send(JSON.stringify({ type: 'join', projectId }));
    await joinedBPromise;
    await presenceBPromise;
    await presenceA2Promise;

    wsB.send(JSON.stringify({ type: 'leave' }));
    const leftB = await nextOfType(wsB, 'left');
    expect(leftB.type).toBe('left');

    const presence = await nextOfType(wsA, 'presence');
    expect(presence.type).toBe('presence');
    expect(presence.users as unknown[]).toHaveLength(1);
    expect(rooms.size(`project:${projectId}`)).toBe(1);

    wsA.close();
    wsB.close();
    const [ca, cb] = await Promise.allSettled([waitClose(wsA), waitClose(wsB)]);
    expect(ca.status).toBe('fulfilled');
    expect(cb.status).toBe('fulfilled');
  });

  it('terminates connections that do not answer heartbeats', async () => {
    const cookie = await register(`ws-hb-${uniqueIp()}@test.dev`);
    const hbServer = createServer(app);
    const hbRealtime = createRealtimeServer(hbServer, new RoomRegistry(), { heartbeatMs: 60 });
    await new Promise<void>((resolve) => hbServer.listen(0, resolve));
    const hbPort = (hbServer.address() as AddressInfo).port;
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${hbPort}${WS_PATH}`, {
        headers: { Cookie: cookie },
        autoPong: false,
      });
      await new Promise<void>((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });
      const closed = await new Promise<{ code: number }>((resolve) => {
        ws.once('close', (code) => resolve({ code }));
      });
      expect(closed.code).toBe(1006);
    } finally {
      hbRealtime.close();
      hbServer.close();
    }
  });

  it('closes the connection when the session token becomes stale (jwt_version bump)', async () => {
    const cookie = await register(`ws-stale-${uniqueIp()}@test.dev`);
    const change = await request(app)
      .patch('/api/v1/auth/password')
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ currentPassword: 'password123', newPassword: 'newpassword123' });
    expect(change.status).toBe(200);

    const ws = await openWs(cookie);
    const closed = await waitClose(ws);
    expect(closed.code).toBe(WS_CLOSE.UNAUTHORIZED);
  });

  it('sends an error frame for malformed messages', async () => {
    const cookie = await register(`ws-bad-${uniqueIp()}@test.dev`);
    const ws = await openWs(cookie);
    await nextMessage(ws);

    ws.send('not json');
    const error = await nextMessage(ws);
    expect(error.type).toBe('error');
    expect(error.code).toBe(4000);

    ws.send(JSON.stringify({ type: 'join', projectId: 'not-a-uuid' }));
    const error2 = await nextMessage(ws);
    expect(error2.type).toBe('error');
    expect(error2.code).toBe(4000);

    ws.send(JSON.stringify({ type: 'bogus' }));
    const error3 = await nextMessage(ws);
    expect(error3.type).toBe('error');
    expect(error3.code).toBe(4000);
    expect(ws.readyState).toBe(WebSocket.OPEN);

    ws.close();
    await waitClose(ws);
  });

  it('joins a team room as a member and rejects outsiders', async () => {
    const ownerCookie = await register(`ws-tm1-${uniqueIp()}@test.dev`);
    const outsiderCookie = await register(`ws-tm2-${uniqueIp()}@test.dev`);
    const teamId = await createTeam(ownerCookie, 'Chat team');

    const ws = await openWs(ownerCookie);
    await nextMessage(ws);
    ws.send(JSON.stringify({ type: 'joinTeam', teamId }));
    const joined = await nextMessage(ws);
    expect(joined.type).toBe('joinedTeam');
    expect(joined.teamId).toBe(teamId);
    expect(rooms.size(`team:${teamId}`)).toBe(1);

    const outsider = await openWs(outsiderCookie);
    await nextMessage(outsider);
    outsider.send(JSON.stringify({ type: 'joinTeam', teamId }));
    const error = await nextMessage(outsider);
    expect(error.type).toBe('error');
    expect(error.code).toBe(403);
    expect(outsider.readyState).toBe(WebSocket.OPEN);

    ws.close();
    outsider.close();
    await Promise.allSettled([waitClose(ws), waitClose(outsider)]);
  });

  it('persists chat messages and broadcasts to the team room', async () => {
    const ownerCookie = await register(`ws-cs1-${uniqueIp()}@test.dev`);
    const memberCookie = await register(`ws-cs2-${uniqueIp()}@test.dev`);
    const teamId = await createTeam(ownerCookie, 'Chat team 2');
    await inviteUser(ownerCookie, memberCookie, teamId);

    const sender = await openWs(ownerCookie);
    await nextMessage(sender);
    sender.send(JSON.stringify({ type: 'joinTeam', teamId }));
    await nextMessage(sender);

    const member = await openWs(memberCookie);
    await nextMessage(member);
    member.send(JSON.stringify({ type: 'joinTeam', teamId }));
    await nextMessage(member);

    const sentPromise = nextOfType(sender, 'message:sent');
    const newPromise = nextOfType(member, 'message:new');
    sender.send(
      JSON.stringify({ type: 'chat:send', teamId, content: 'Hello from ws', refs: [] }),
    );

    const sent = await sentPromise;
    expect(sent.type).toBe('message:sent');
    expect((sent.message as { content: string }).content).toBe('Hello from ws');
    expect((sent.message as { id: string }).id).toEqual(expect.any(String));

    const received = await newPromise;
    expect(received.type).toBe('message:new');
    expect((received.message as { content: string }).content).toBe('Hello from ws');

    const list = await request(app)
      .get(`/api/v1/teams/${teamId}/messages`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(200);
    expect(list.body.messages).toHaveLength(1);
    expect(list.body.messages[0].content).toBe('Hello from ws');

    sender.close();
    member.close();
    await Promise.allSettled([waitClose(sender), waitClose(member)]);
  });

  it('rejects invalid chat payloads without persisting', async () => {
    const cookie = await register(`ws-cs3-${uniqueIp()}@test.dev`);
    const teamId = await createTeam(cookie, 'Chat team 3');
    const ws = await openWs(cookie);
    await nextMessage(ws);
    ws.send(JSON.stringify({ type: 'joinTeam', teamId }));
    await nextMessage(ws);

    ws.send(JSON.stringify({ type: 'chat:send', teamId, content: '' }));
    const e1 = await nextMessage(ws);
    expect(e1.type).toBe('error');
    expect(e1.code).toBe(4000);

    ws.send(JSON.stringify({ type: 'chat:send', teamId, content: 'x'.repeat(4001) }));
    const e2 = await nextMessage(ws);
    expect(e2.type).toBe('error');
    expect(e2.code).toBe(4000);

    ws.send(
      JSON.stringify({
        type: 'chat:send',
        teamId,
        content: 'bad ref',
        refs: [{ entity: 'bogus', entityId: crypto.randomUUID() }],
      }),
    );
    const e3 = await nextMessage(ws);
    expect(e3.type).toBe('error');
    expect(e3.code).toBe(4000);

    const list = await request(app)
      .get(`/api/v1/teams/${teamId}/messages`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(list.status).toBe(200);
    expect(list.body.messages).toHaveLength(0);

    ws.close();
    await waitClose(ws);
  });

  it('broadcasts REST-sent messages to the team room', async () => {
    const ownerCookie = await register(`ws-cs4-${uniqueIp()}@test.dev`);
    const memberCookie = await register(`ws-cs5-${uniqueIp()}@test.dev`);
    const teamId = await createTeam(ownerCookie, 'Chat team 4');
    await inviteUser(ownerCookie, memberCookie, teamId);

    const member = await openWs(memberCookie);
    await nextMessage(member);
    member.send(JSON.stringify({ type: 'joinTeam', teamId }));
    await nextMessage(member);

    const newPromise = nextOfType(member, 'message:new');
    const post = await request(app)
      .post(`/api/v1/teams/${teamId}/messages`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ content: 'REST broadcast', refs: [] });
    expect(post.status).toBe(201);

    const received = await newPromise;
    expect(received.type).toBe('message:new');
    expect((received.message as { content: string }).content).toBe('REST broadcast');

    member.close();
    await waitClose(member);
  });
});