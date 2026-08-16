import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from './types';
import type { State } from './types';
import { RealtimeSocket, applyStateDiff, realtimeWsUrl } from './realtime-client';
import type { StateDiff, StateDiffOp } from './realtime-client';

function makeState(): State {
  return {
    tasks: [
      {
        id: 't1',
        title: 'Original',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

function task(id: string, title: string): Task {
  return {
    id,
    title,
    status: 'todo',
    priority: 'medium',
    labels: [],
    blockedBy: [],
    description: '',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

function diff(ops: StateDiffOp[]): StateDiff {
  return { type: 'state:diff', projectId: 'p1', version: 2, ops };
}

describe('applyStateDiff', () => {
  it('appends created ops at the end', () => {
    const next = applyStateDiff(makeState(), diff([{ entity: 'tasks', id: 't2', op: 'created', after: task('t2', 'New') }]), new Set());
    expect(next).not.toBe(makeState());
    expect(next.tasks).toHaveLength(2);
    expect(next.tasks[1]!.title).toBe('New');
  });

  it('replaces updated ops in place, preserving the index', () => {
    const state = makeState();
    state.tasks.push(task('t2', 'Second'));
    const next = applyStateDiff(
      state,
      diff([{ entity: 'tasks', id: 't1', op: 'updated', after: { ...state.tasks[0]!, title: 'Edited' } }]),
      new Set(),
    );
    expect(next.tasks[0]!.title).toBe('Edited');
    expect(next.tasks[1]!.id).toBe('t2');
  });

  it('removes deleted ops', () => {
    const next = applyStateDiff(makeState(), diff([{ entity: 'tasks', id: 't1', op: 'deleted' }]), new Set());
    expect(next.tasks).toHaveLength(0);
  });

  it('skips ops whose entity:id is in ownKeys and returns the same reference', () => {
    const state = makeState();
    const next = applyStateDiff(
      state,
      diff([{ entity: 'tasks', id: 't1', op: 'updated', after: { ...state.tasks[0]!, title: 'Server' } }]),
      new Set(['tasks:t1']),
    );
    expect(next).toBe(state);
  });

  it('ignores unknown entities and returns the same reference', () => {
    const state = makeState();
    const next = applyStateDiff(state, diff([{ entity: 'widgets', id: 'w1', op: 'created', after: {} }]), new Set());
    expect(next).toBe(state);
  });

  it('returns the same reference for an empty op list', () => {
    const state = makeState();
    const next = applyStateDiff(state, diff([]), new Set());
    expect(next).toBe(state);
  });
});

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  readyState = 0;
  sent: string[] = [];
  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, cb: (event: MessageEvent) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(cb);
    this.listeners.set(type, set);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.fire('close');
  }

  open(): void {
    this.readyState = 1;
    this.fire('open');
  }

  drop(): void {
    this.readyState = 3;
    this.fire('close');
  }

  emit(data: string): void {
    this.fire('message', { data } as unknown as MessageEvent);
  }

  private fire(type: string, event?: MessageEvent): void {
    for (const cb of this.listeners.get(type) ?? []) cb((event ?? {}) as MessageEvent);
  }
}

describe('RealtimeSocket', () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function makeSocket(overrides: Partial<ConstructorParameters<typeof RealtimeSocket>[0]> = {}) {
    return new RealtimeSocket({
      wsUrl: 'ws://localhost/ws',
      projectId: 'p1',
      WebSocketCtor: FakeWebSocket,
      ...overrides,
    });
  }

  it('joins the project room on open', () => {
    const socket = makeSocket();
    const ws = FakeWebSocket.instances[0]!;
    ws.open();
    expect(ws.sent[0]).toBe(JSON.stringify({ type: 'join', projectId: 'p1' }));
    socket.close();
  });

  it('dispatches server messages to the callbacks', () => {
    const onDiff = vi.fn();
    const onSync = vi.fn();
    const onJoined = vi.fn();
    const onPresence = vi.fn();
    const onActivity = vi.fn();
    const socket = makeSocket({ onDiff, onSync, onJoined, onPresence, onActivity });
    const ws = FakeWebSocket.instances[0]!;
    ws.open();
    ws.emit(JSON.stringify({ type: 'joined', projectId: 'p1', role: 'editor', teamId: 'team1' }));
    ws.emit(JSON.stringify({ type: 'state:diff', projectId: 'p1', version: 2, ops: [] }));
    ws.emit(JSON.stringify({ type: 'state:sync', projectId: 'p1', version: 2 }));
    ws.emit(
      JSON.stringify({ type: 'presence', projectId: 'p1', users: [{ userId: 'u1', name: 'One' }] }),
    );
    ws.emit(
      JSON.stringify({
        type: 'activity:new',
        projectId: 'p1',
        entry: { id: 'a1', entity: 'tasks', action: 'created', summary: 'RT activity' },
      }),
    );
    expect(onJoined).toHaveBeenCalledTimes(1);
    expect(onDiff).toHaveBeenCalledTimes(1);
    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onPresence).toHaveBeenCalledWith({
      type: 'presence',
      projectId: 'p1',
      users: [{ userId: 'u1', name: 'One' }],
    });
    expect(onActivity).toHaveBeenCalledWith({
      type: 'activity:new',
      projectId: 'p1',
      entry: { id: 'a1', entity: 'tasks', action: 'created', summary: 'RT activity' },
    });
    socket.close();
  });

  it('sends a ping every 25 seconds while open', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const socket = makeSocket();
    const ws = FakeWebSocket.instances[0]!;
    ws.open();
    vi.advanceTimersByTime(25_000);
    expect(ws.sent.filter((m) => m.includes('"ping"'))).toHaveLength(1);
    vi.advanceTimersByTime(25_000);
    expect(ws.sent.filter((m) => m.includes('"ping"'))).toHaveLength(2);
    socket.close();
  });

  it('reconnects with backoff after an unexpected close', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const socket = makeSocket();
    FakeWebSocket.instances[0]!.open();
    FakeWebSocket.instances[0]!.drop();
    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.instances[1]!.open();
    FakeWebSocket.instances[1]!.drop();

    vi.advanceTimersByTime(2_000);
    expect(FakeWebSocket.instances).toHaveLength(3);
    socket.close();
  });

  it('stops reconnecting after close()', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const socket = makeSocket();
    FakeWebSocket.instances[0]!.open();
    FakeWebSocket.instances[0]!.drop();
    socket.close();
    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('caps the reconnect backoff at 15 seconds', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const socket = makeSocket();
    FakeWebSocket.instances[0]!.open();
    FakeWebSocket.instances[0]!.drop();
    vi.advanceTimersByTime(1_000);
    FakeWebSocket.instances[1]!.open();
    FakeWebSocket.instances[1]!.drop();
    vi.advanceTimersByTime(2_000);
    FakeWebSocket.instances[2]!.open();
    FakeWebSocket.instances[2]!.drop();
    vi.advanceTimersByTime(4_000);
    FakeWebSocket.instances[3]!.open();
    FakeWebSocket.instances[3]!.drop();
    vi.advanceTimersByTime(8_000);
    FakeWebSocket.instances[4]!.open();
    FakeWebSocket.instances[4]!.drop();

    vi.advanceTimersByTime(15_000);
    expect(FakeWebSocket.instances).toHaveLength(6);
    FakeWebSocket.instances[5]!.open();
    FakeWebSocket.instances[5]!.drop();

    vi.advanceTimersByTime(15_000);
    expect(FakeWebSocket.instances).toHaveLength(7);
    socket.close();
  });

  it('stops pinging after an intentional close()', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const socket = makeSocket();
    const ws = FakeWebSocket.instances[0]!;
    ws.open();
    vi.advanceTimersByTime(25_000);
    expect(ws.sent.filter((m) => m.includes('"ping"'))).toHaveLength(1);

    socket.close();
    vi.advanceTimersByTime(25_000);
    expect(ws.sent.filter((m) => m.includes('"ping"'))).toHaveLength(1);
  });

  it('ignores malformed frames', () => {
    const onDiff = vi.fn();
    const socket = makeSocket({ onDiff });
    const ws = FakeWebSocket.instances[0]!;
    ws.open();
    ws.emit('not json');
    ws.emit(JSON.stringify({ nope: true }));
    expect(onDiff).not.toHaveBeenCalled();
    socket.close();
  });
});

describe('realtimeWsUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('converts an http(s) API base into a ws(s) url on /ws', () => {
    expect(realtimeWsUrl('http://localhost:3000/api/v1')).toBe('ws://localhost:3000/ws');
    expect(realtimeWsUrl('https://devhub.example.com/api/v1')).toBe('wss://devhub.example.com/ws');
  });

  it('falls back to a same-origin /ws url', () => {
    vi.stubGlobal('location', { protocol: 'https:', host: 'devhub.example.com' });
    expect(realtimeWsUrl('/api/v1')).toBe('wss://devhub.example.com/ws');
  });
});
