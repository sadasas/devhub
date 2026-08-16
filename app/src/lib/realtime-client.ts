import type { ActivityEntry, GranularEntity } from './api';
import type { ChatMessage, State } from './types';

/* ------------------------------------------------------------------ */
/* Wire protocol (mirror of server/src/realtime/broadcast.ts)          */
/* ------------------------------------------------------------------ */

export interface StateDiffOp {
  entity: string;
  id: string;
  op: 'created' | 'updated' | 'deleted';
  after?: unknown;
}

export interface StateDiff {
  type: 'state:diff';
  projectId: string;
  version: number;
  ops: StateDiffOp[];
}

export interface StateSync {
  type: 'state:sync';
  projectId: string;
  version: number;
}

export interface PresenceUser {
  userId: string;
  name: string;
  /** Current user activity (e.g. 'Editing task'), null when idle. */
  activity?: string | null;
}

export interface PresenceUpdate {
  type: 'presence';
  projectId: string;
  users: PresenceUser[];
}

export interface ActivityNew {
  type: 'activity:new';
  projectId: string;
  entry: ActivityEntry;
}

/* ------------------------------------------------------------------ */
/* Pure diff application                                               */
/* ------------------------------------------------------------------ */

const ENTITY_KEYS: ReadonlySet<string> = new Set<GranularEntity>([
  'tasks',
  'issues',
  'testCases',
  'techEntries',
  'tables',
  'relations',
  'schemaVersions',
  'decisions',
  'milestones',
  'apiCollections',
  'apiEndpoints',
  'whiteboards',
]);

function isGranularEntity(value: string): value is GranularEntity {
  return ENTITY_KEYS.has(value);
}

/**
 * Applies a server state:diff to the local state, returning a NEW state
 * object only when at least one op is applied (reference-equality check
 * tells the caller whether anything changed).
 *
 * Ops whose key (`entity:id`) is in `ownKeys` are skipped — those are the
 * caller's own pending mutations, already reflected optimistically and
 * about to be confirmed by the mutation queue flush.
 */
export function applyStateDiff(state: State, diff: StateDiff, ownKeys: ReadonlySet<string>): State {
  let next = state;
  for (const op of diff.ops) {
    if (!isGranularEntity(op.entity)) continue;
    const key = `${op.entity}:${op.id}`;
    if (ownKeys.has(key)) continue;
    if (op.op !== 'deleted' && op.after === undefined) continue;

    const items = next[op.entity] as { id: string }[];
    if (op.op === 'created') {
      next = { ...next, [op.entity]: [...items, op.after as { id: string }] };
    } else if (op.op === 'updated') {
      const idx = items.findIndex((it) => it.id === op.id);
      if (idx === -1) continue;
      const copy = items.slice();
      copy[idx] = op.after as { id: string };
      next = { ...next, [op.entity]: copy };
    } else {
      next = { ...next, [op.entity]: items.filter((it) => it.id !== op.id) };
    }
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Socket URL                                                          */
/* ------------------------------------------------------------------ */

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export function realtimeWsUrl(apiBase: string = API_BASE): string {
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    const url = new URL(apiBase);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws';
    url.search = '';
    url.hash = '';
    return url.toString();
  }
  const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

/* ------------------------------------------------------------------ */
/* Realtime socket with auto-reconnect                                 */
/* ------------------------------------------------------------------ */

export interface RealtimeHandlers {
  /** Fired when the socket opens (before the join frame is sent). */
  onOpen?: () => void;
  /** Fired whenever the socket closes (dropped or explicitly closed). */
  onClose?: () => void;
  onJoined?: () => void;
  onDiff?: (diff: StateDiff) => void;
  onSync?: (sync: StateSync) => void;
  onPresence?: (presence: PresenceUpdate) => void;
  onActivity?: (msg: ActivityNew) => void;
}

export interface MinimalWebSocket {
  readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
}

export interface RealtimeSocketOptions extends RealtimeHandlers {
  wsUrl: string;
  projectId: string;
  WebSocketCtor?: new (url: string) => MinimalWebSocket;
}

const RECONNECT_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];
const PING_INTERVAL_MS = 25_000;

export class RealtimeSocket {
  private readonly opts: RealtimeSocketOptions;
  private ws: MinimalWebSocket | null = null;
  private closed = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: RealtimeSocketOptions) {
    this.opts = opts;
    this.connect();
  }

  private connect(): void {
    if (this.closed) return;
    // In vitest (MODE=test) the undici WebSocket global leaks into jsdom;
    // never auto-connect there unless a constructor was injected.
    const inTest = import.meta.env.MODE === 'test';
    const Ctor =
      this.opts.WebSocketCtor ?? (!inTest && typeof globalThis.WebSocket === 'function' ? globalThis.WebSocket : null);
    if (!Ctor) return;

    let ws: MinimalWebSocket;
    try {
      ws = new Ctor(this.opts.wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.attempt = 0;
      this.opts.onOpen?.();
      ws.send(JSON.stringify({ type: 'join', projectId: this.opts.projectId }));
      this.startPing();
    });
    ws.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(event);
    });
    ws.addEventListener('close', () => {
      this.onSocketClose();
    });
    ws.addEventListener('error', () => {
      /* close event follows */
    });
  }

  private handleMessage(event: MessageEvent): void {
    let msg: unknown;
    try {
      msg = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (typeof msg !== 'object' || msg === null) return;
    const type = (msg as { type?: unknown }).type;
    if (type === 'joined') {
      this.opts.onJoined?.();
    } else if (type === 'state:diff') {
      this.opts.onDiff?.(msg as StateDiff);
    } else if (type === 'state:sync') {
      this.opts.onSync?.(msg as StateSync);
    } else if (type === 'presence') {
      this.opts.onPresence?.(msg as PresenceUpdate);
    } else if (type === 'activity:new') {
      this.opts.onActivity?.(msg as ActivityNew);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === 1) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private onSocketClose(): void {
    this.stopPing();
    this.ws = null;
    this.opts.onClose?.();
    if (this.closed) return;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== null) return;
    const delay = RECONNECT_BACKOFF_MS[Math.min(this.attempt, RECONNECT_BACKOFF_MS.length - 1)];
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  close(): void {
    this.closed = true;
    this.stopPing();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  /** Announces the current user activity to the server (null = idle). */
  sendStatus(activity: string | null): void {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'status', activity }));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Team chat socket (M13) — join team:{id}, message:new / message:sent */
/* ------------------------------------------------------------------ */

export interface TeamChatHandlers {
  onJoinedTeam?: () => void;
  onMessageNew?: (teamId: string, message: ChatMessage) => void;
  onMessageSent?: (teamId: string, message: ChatMessage) => void;
}

export interface TeamChatSocketOptions extends TeamChatHandlers {
  wsUrl: string;
  teamId: string;
  WebSocketCtor?: new (url: string) => MinimalWebSocket;
  onClose?: () => void;
}

export class TeamChatSocket {
  private readonly opts: TeamChatSocketOptions;
  private ws: MinimalWebSocket | null = null;
  private closed = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: TeamChatSocketOptions) {
    this.opts = opts;
    this.connect();
  }

  private connect(): void {
    if (this.closed) return;
    const inTest = import.meta.env.MODE === 'test';
    const Ctor =
      this.opts.WebSocketCtor ??
      (!inTest && typeof globalThis.WebSocket === 'function' ? globalThis.WebSocket : null);
    if (!Ctor) return;

    let ws: MinimalWebSocket;
    try {
      ws = new Ctor(this.opts.wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.attempt = 0;
      ws.send(JSON.stringify({ type: 'joinTeam', teamId: this.opts.teamId }));
      this.startPing();
    });
    ws.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(event);
    });
    ws.addEventListener('close', () => {
      this.onSocketClose();
    });
    ws.addEventListener('error', () => {
      /* close event follows */
    });
  }

  private handleMessage(event: MessageEvent): void {
    let msg: unknown;
    try {
      msg = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (typeof msg !== 'object' || msg === null) return;
    const type = (msg as { type?: unknown }).type;
    if (type === 'joinedTeam') {
      this.opts.onJoinedTeam?.();
    } else if (type === 'message:new') {
      const m = msg as { teamId: string; message: ChatMessage };
      this.opts.onMessageNew?.(m.teamId, m.message);
    } else if (type === 'message:sent') {
      const m = msg as { teamId: string; message: ChatMessage };
      this.opts.onMessageSent?.(m.teamId, m.message);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === 1) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private onSocketClose(): void {
    this.stopPing();
    if (this.closed) {
      this.opts.onClose?.();
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== null) return;
    const delay = RECONNECT_BACKOFF_MS[Math.min(this.attempt, RECONNECT_BACKOFF_MS.length - 1)];
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  close(): void {
    this.closed = true;
    this.stopPing();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}
