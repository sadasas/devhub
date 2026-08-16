import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { WebSocket, type RawData } from 'ws';
import { createRealtimeServer, WS_PATH, type RealtimeServer } from '../src/realtime/ws-server.js';
import { RoomRegistry } from '../src/realtime/rooms.js';
import { attachRoomRegistry, broadcastDiff, type StateDiff } from '../src/realtime/broadcast.js';
import { emptyState } from '../src/schema/state.js';
import { app, createKey, createProject, register, uniqueIp } from './helpers.js';
import { resetDb } from './setup.js';
import { newId } from '../src/lib/ids.js';

let httpServer: Server;
let realtime: RealtimeServer;
let port: number;
const rooms = new RoomRegistry();

beforeAll(async () => {
  await resetDb();
  httpServer = createServer(app);
  attachRoomRegistry(rooms);
  realtime = createRealtimeServer(httpServer, rooms);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  port = (httpServer.address() as AddressInfo).port;
});

afterAll(() => {
  realtime.close();
  httpServer.close();
});

describe('broadcast bridge', () => {
  it('forwards diffs to the attached registry room', () => {
    const sent: { room: string; message: unknown }[] = [];
    attachRoomRegistry({
      broadcast: (room: string, message: unknown) => {
        sent.push({ room, message });
      },
    } as unknown as RoomRegistry);

    const diff: StateDiff = {
      type: 'state:diff',
      projectId: 'p1',
      version: 2,
      ops: [{ entity: 'tasks', id: 't1', op: 'created', after: { id: 't1' } }],
    };
    broadcastDiff('p1', diff);
    expect(sent).toEqual([{ room: 'project:p1', message: diff }]);

    attachRoomRegistry(rooms);
  });
});

describe('realtime state broadcast', () => {
  function openWs(cookie: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}${WS_PATH}`, {
        headers: { Cookie: cookie },
      });
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  }

  function nextMessage(ws: WebSocket, timeoutMs = 3000): Promise<Record<string, unknown>> {
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

  function nextOfType(ws: WebSocket, type: string, timeoutMs = 3000): Promise<Record<string, unknown>> {
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

  function expectNoMessage(ws: WebSocket, graceMs = 400): Promise<void> {
    return new Promise((resolve, reject) => {
      const onMessage = () => {
        clearTimeout(timer);
        ws.off('message', onMessage);
        reject(new Error('unexpected ws message'));
      };
      const timer = setTimeout(() => {
        ws.off('message', onMessage);
        resolve();
      }, graceMs);
      ws.on('message', onMessage);
    });
  }

  async function joinProject(cookie: string, projectId: string): Promise<WebSocket> {
    const ws = await openWs(cookie);
    await nextMessage(ws);
    ws.send(JSON.stringify({ type: 'join', projectId }));
    const joined = await nextMessage(ws);
    expect(joined.type).toBe('joined');
    return ws;
  }

  it('broadcasts a created diff when an entity is posted', async () => {
    const cookie = await register(`br-create-${uniqueIp()}@test.dev`);
    const projectId = await createProject(cookie, 'BR create');
    const ws = await joinProject(cookie, projectId);
    const diffPromise = nextOfType(ws, 'state:diff');

    const res = await request(httpServer)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: newId(),
        title: 'RT task',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        description: '',
      });
    expect(res.status).toBe(201);

    const diff = await diffPromise;
    expect(diff).toMatchObject({
      type: 'state:diff',
      projectId,
      version: 2,
      ops: [{ entity: 'tasks', op: 'created' }],
    });
    const op = (diff.ops as Record<string, unknown>[])[0]!;
    expect(op.id).toBe(res.body.entity.id);
    expect(op.after).toMatchObject({ title: 'RT task', status: 'todo' });

    ws.close();
  });

  it('broadcasts an updated diff with the full entity after a patch', async () => {
    const cookie = await register(`br-update-${uniqueIp()}@test.dev`);
    const projectId = await createProject(cookie, 'BR update');
    const created = await request(httpServer)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: newId(),
        title: 'Before',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        description: '',
      });
    const taskId = created.body.entity.id;
    const ws = await joinProject(cookie, projectId);
    const diffPromise = nextOfType(ws, 'state:diff');

    const res = await request(httpServer)
      .patch(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ title: 'After' });
    expect(res.status).toBe(200);

    const diff = await diffPromise;
    expect(diff).toMatchObject({
      type: 'state:diff',
      projectId,
      version: 3,
      ops: [{ entity: 'tasks', id: taskId, op: 'updated' }],
    });
    const op = (diff.ops as Record<string, unknown>[])[0]!;
    expect(op.after).toMatchObject({ id: taskId, title: 'After' });

    ws.close();
  });

  it('broadcasts a deleted diff without an after entity', async () => {
    const cookie = await register(`br-delete-${uniqueIp()}@test.dev`);
    const projectId = await createProject(cookie, 'BR delete');
    const created = await request(httpServer)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: newId(),
        title: 'Doomed',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        description: '',
      });
    const taskId = created.body.entity.id;
    const ws = await joinProject(cookie, projectId);
    const diffPromise = nextOfType(ws, 'state:diff');

    const res = await request(httpServer)
      .delete(`/api/v1/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp());
    expect(res.status).toBe(200);

    const diff = await diffPromise;
    expect(diff).toMatchObject({
      type: 'state:diff',
      projectId,
      ops: [{ entity: 'tasks', id: taskId, op: 'deleted' }],
    });
    const op = (diff.ops as Record<string, unknown>[])[0]!;
    expect('after' in op).toBe(false);

    ws.close();
  });

  it('broadcasts an activity:new frame after an entity mutation', async () => {
    const cookie = await register(`br-act-${uniqueIp()}@test.dev`);
    const projectId = await createProject(cookie, 'BR activity');
    const ws = await joinProject(cookie, projectId);
    const activityPromise = nextOfType(ws, 'activity:new');

    const res = await request(httpServer)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: newId(),
        title: 'Activity broadcast',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        description: '',
      });
    expect(res.status).toBe(201);

    const frame = await activityPromise;
    expect(frame).toMatchObject({
      type: 'activity:new',
      projectId,
      entry: {
        entity: 'tasks',
        action: 'created',
        summary: 'Activity broadcast',
      },
    });
    const entry = frame.entry as Record<string, unknown>;
    expect(entry.authorId).not.toBeNull();
    expect(typeof entry.id).toBe('string');
    expect(typeof entry.createdAt).toBe('string');

    const updatePromise = nextOfType(ws, 'activity:new');
    await request(httpServer)
      .patch(`/api/v1/projects/${projectId}/tasks/${res.body.entity.id}`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ status: 'done' });
    const updated = await updatePromise;
    expect(updated.entry).toMatchObject({ entity: 'tasks', action: 'updated' });

    ws.close();
  });

  it('does not broadcast to users without membership', async () => {
    const ownerCookie = await register(`br-owner-${uniqueIp()}@test.dev`);
    const outsiderCookie = await register(`br-outsider-${uniqueIp()}@test.dev`);
    const projectId = await createProject(ownerCookie, 'BR private');

    const ws = await openWs(outsiderCookie);
    await nextMessage(ws);
    ws.send(JSON.stringify({ type: 'join', projectId }));
    const error = await nextMessage(ws);
    expect(error.code).toBe(403);

    await request(httpServer)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set('Cookie', ownerCookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        id: newId(),
        title: 'Secret',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        description: '',
      });

    await expectNoMessage(ws);
    ws.close();
  });

  it('broadcasts a coarse sync after a bulk state PUT', async () => {
    const cookie = await register(`br-sync-${uniqueIp()}@test.dev`);
    const projectId = await createProject(cookie, 'BR sync');
    const ws = await joinProject(cookie, projectId);
    const syncPromise = nextOfType(ws, 'state:sync');

    const res = await request(httpServer)
      .put(`/api/v1/projects/${projectId}/state`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', uniqueIp())
      .send({ state: emptyState, version: 1 });
    expect(res.status).toBe(200);

    const sync = await syncPromise;
    expect(sync).toEqual({ type: 'state:sync', projectId, version: 2 });

    ws.close();
  });

  it('broadcasts a coarse sync after an MCP tool writes the state', async () => {
    const cookie = await register(`br-mcp-${uniqueIp()}@test.dev`);
    const key = await createKey(cookie);
    const projectId = await createProject(cookie, 'BR mcp');
    const ws = await joinProject(cookie, projectId);
    const syncPromise = nextOfType(ws, 'state:sync');

    const res = await request(httpServer)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('Authorization', `Bearer ${key}`)
      .set('X-Forwarded-For', uniqueIp())
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'create_task',
          arguments: {
            projectId,
            title: 'MCP task',
            status: 'todo',
            priority: 'medium',
            labels: [],
            blockedBy: [],
            description: '',
          },
        },
      });
    expect(res.status).toBe(200);

    const sync = await syncPromise;
    expect(sync).toEqual({ type: 'state:sync', projectId, version: 2 });

    ws.close();
  });

  it('reflects status frames in the presence broadcast', async () => {
    const cookie = await register(`br-status-${uniqueIp()}@test.dev`);
    const projectId = await createProject(cookie, 'BR status');
    const ws = await joinProject(cookie, projectId);
    await nextOfType(ws, 'presence').catch(() => {});

    const activePromise = nextOfType(ws, 'presence');
    ws.send(JSON.stringify({ type: 'status', activity: 'Editing task' }));
    const active = await activePromise;
    expect(active).toMatchObject({ type: 'presence', projectId });
    expect((active.users as Record<string, unknown>[])[0]).toMatchObject({ activity: 'Editing task' });

    const idlePromise = nextOfType(ws, 'presence');
    ws.send(JSON.stringify({ type: 'status', activity: null }));
    const idle = await idlePromise;
    expect((idle.users as Record<string, unknown>[])[0]).toMatchObject({ activity: null });

    ws.close();
  });

  it('rejects a status activity longer than 200 characters', async () => {
    const cookie = await register(`br-statuslen-${uniqueIp()}@test.dev`);
    const projectId = await createProject(cookie, 'BR status len');
    const ws = await joinProject(cookie, projectId);
    await nextOfType(ws, 'presence').catch(() => {});

    ws.send(JSON.stringify({ type: 'status', activity: 'x'.repeat(201) }));
    const error = await nextMessage(ws);
    expect(error.code).toBe(4000);

    ws.close();
  });
});