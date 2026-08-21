import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { z } from 'zod';
import { SESSION_COOKIE } from '../../../shared/http.js';
import { config } from '../../../config.js';
import { verifySession } from '../../auth/infrastructure/jwt.js';
import { getProjectWithRole, getTeamWithRole } from '../../authorization/application/authz.js';
import { pool } from '../../../db/pool.js';
import { logger } from '../../../shared/logger.js';
import { chatRefSchema } from '../../teams/domain/chat.js';
import { insertMessage, messageJson } from '../../teams/application/chat.js';
import type { RoomRegistry } from '../infrastructure/rooms.js';

declare module 'ws' {
  interface WebSocket {
    isAlive?: boolean;
    userId?: string;
    activity?: string | null;
  }
}

export const WS_PATH = '/ws';

export const WS_CLOSE = {
  UNAUTHORIZED: 4001,
  INTERNAL: 1011,
} as const;

const HEARTBEAT_MS = 30_000;
/** Payload maksimum per pesan klien (audit 2026-08b, WS-2). */
const MAX_PAYLOAD = 16 * 1024;
/** Debounce broadcast presence per room (audit 2026-08b, REALTIME-1). */
const PRESENCE_DEBOUNCE_MS = 1_000;
/** Sliding window chat:send via WS (audit 2026-08b, WS-2). */
const CHAT_THROTTLE = { windowMs: 10_000, max: 10 };

export interface RealtimeServerOptions {
  /** Heartbeat interval in ms; injectable for tests. Default 30s. */
  heartbeatMs?: number;
}

const wsMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), projectId: z.string().uuid() }),
  z.object({ type: z.literal('joinTeam'), teamId: z.string().uuid() }),
  z.object({
    type: z.literal('chat:send'),
    teamId: z.string().uuid(),
    content: z.string().trim().min(1).max(4000),
    refs: z.array(chatRefSchema).max(10).default([]),
  }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('status'), activity: z.string().trim().max(200).nullable() }),
]);

export interface RealtimeServer {
  wss: WebSocketServer;
  /** Returns remaining open client count (0 when fully drained). */
  close(): number;
}

function parseSessionCookie(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE && rest.length > 0) return rest.join('=');
  }
  return undefined;
}

/**
 * Origin check (audit 2026-08b, WS-1): browser cross-site hijacking diblokir
 * di level handshake. Klien non-browser (tanpa Origin) diizinkan — auth tetap
 * lewat cookie sesi. Sama-origin default; allowlist CORS_ORIGIN bila di-set.
 */
function isOriginAllowed(origin: string | undefined, req: IncomingMessage): boolean {
  if (!origin) return true;
  if (config.CORS_ORIGIN.length > 0) return config.CORS_ORIGIN.includes(origin);
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function sendError(socket: WebSocket, code: number, message: string): void {
  send(socket, { type: 'error', code, message });
}

/**
 * Broadcasts a presence snapshot to a project room: unique authenticated
 * members' userIds (satu user multi-tab = satu entri), dengan display names
 * dari users table. Debounce per room (REALTIME-1). Best-effort — kegagalan
 * DB hanya log, tidak mematikan koneksi.
 */
async function broadcastPresence(rooms: RoomRegistry, projectId: string): Promise<void> {
  const members = rooms.members(`project:${projectId}`);
  const unique = new Map<string, WebSocket>();
  for (const s of members) {
    if (s.userId && !unique.has(s.userId)) unique.set(s.userId, s);
  }
  if (unique.size === 0) return;
  const userIds = [...unique.keys()];
  try {
    const result = await pool.query<{ id: string; display_name: string }>(
      'SELECT id, display_name FROM users WHERE id = ANY($1::uuid[])',
      [userIds],
    );
    const byId = new Map(result.rows.map((r) => [r.id, r.display_name]));
    rooms.broadcast(`project:${projectId}`, {
      type: 'presence',
      projectId,
      users: userIds.map((userId) => ({
        userId,
        name: byId.get(userId) ?? '',
        activity: unique.get(userId)?.activity ?? null,
      })),
    });
  } catch (err) {
    logger.error('ws-presence-db-error', { error: err instanceof Error ? err.message : err });
  }
}

const presenceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function schedulePresence(rooms: RoomRegistry, projectId: string): void {
  if (presenceTimers.has(projectId)) return;
  const timer = setTimeout(() => {
    presenceTimers.delete(projectId);
    void broadcastPresence(rooms, projectId);
  }, PRESENCE_DEBOUNCE_MS);
  timer.unref?.();
  presenceTimers.set(projectId, timer);
}

/** Sliding-window throttle per (user, team) untuk chat:send via WS. */
const chatSendTimes = new Map<string, number[]>();

function chatThrottled(userId: string, teamId: string): boolean {
  const key = `${userId}:${teamId}`;
  const now = Date.now();
  const window = chatSendTimes.get(key) ?? [];
  const recent = window.filter((t) => now - t < CHAT_THROTTLE.windowMs);
  if (recent.length >= CHAT_THROTTLE.max) {
    chatSendTimes.set(key, recent);
    return true;
  }
  recent.push(now);
  chatSendTimes.set(key, recent);
  return false;
}

export function createRealtimeServer(
  httpServer: Server,
  rooms: RoomRegistry,
  options: RealtimeServerOptions = {},
): RealtimeServer {
  const wss = new WebSocketServer({
    server: httpServer,
    path: WS_PATH,
    maxPayload: MAX_PAYLOAD,
    verifyClient: (info: { origin?: string; req: IncomingMessage }) =>
      isOriginAllowed(info.origin, info.req),
  });

  wss.on('connection', (socket, req) => {
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    // Pesan yang tiba sebelum autentikasi selesai di-buffer (race join-before-hello).
    const queued: RawData[] = [];
    let authenticated = false;

    const handleRawMessage = (data: RawData): void => {
      let message: unknown;
      try {
        message = JSON.parse(data.toString());
      } catch {
        sendError(socket, 4000, 'Bad message: expected JSON');
        return;
      }
      const parsed = wsMessageSchema.safeParse(message);
      if (!parsed.success) {
        sendError(
          socket,
          4000,
          'Bad message: expected {type:"join"|"joinTeam"|"chat:send"|"leave"|"ping"|"status"}',
        );
        return;
      }
      const msg = parsed.data;
      if (msg.type === 'ping') {
        send(socket, { type: 'pong' });
        return;
      }
      const userId = socket.userId;
      if (!userId) {
        socket.close(WS_CLOSE.UNAUTHORIZED, 'UNAUTHORIZED');
        return;
      }
      if (msg.type === 'leave') {
        const roomsLeft = rooms.leaveAll(socket);
        for (const room of roomsLeft) {
          const projectId = room.replace(/^project:/, '');
          if (projectId !== room) schedulePresence(rooms, projectId);
        }
        send(socket, { type: 'left' });
        return;
      }
      if (msg.type === 'joinTeam') {
        void (async () => {
          let team: Awaited<ReturnType<typeof getTeamWithRole>>;
          try {
            team = await getTeamWithRole(userId, msg.teamId);
          } catch (err) {
            logger.error('ws-jointeam-db-error', { error: err instanceof Error ? err.message : err });
            sendError(socket, 500, 'Internal error');
            return;
          }
          if (!team) {
            sendError(socket, 403, 'You do not have access to this team');
            return;
          }
          rooms.join(`team:${msg.teamId}`, socket);
          send(socket, { type: 'joinedTeam', teamId: msg.teamId });
        })();
        return;
      }
      if (msg.type === 'chat:send') {
        if (chatThrottled(userId, msg.teamId)) {
          sendError(socket, 429, 'Too many chat messages, slow down');
          return;
        }
        void (async () => {
          let team: Awaited<ReturnType<typeof getTeamWithRole>>;
          try {
            team = await getTeamWithRole(userId, msg.teamId);
          } catch (err) {
            logger.error('ws-chat-db-error', { error: err instanceof Error ? err.message : err });
            sendError(socket, 500, 'Internal error');
            return;
          }
          if (!team) {
            sendError(socket, 403, 'You do not have access to this team');
            return;
          }
          try {
            const row = await insertMessage(pool, msg.teamId, userId, msg.content, msg.refs);
            const message = messageJson(row);
            const payload = { type: 'message:new', teamId: msg.teamId, message };
            rooms.broadcast(`team:${msg.teamId}`, payload, socket);
            send(socket, { type: 'message:sent', teamId: msg.teamId, message });
          } catch (err) {
            logger.error('ws-chat-insert-error', { error: err instanceof Error ? err.message : err });
            sendError(socket, 500, 'Internal error');
          }
        })();
        return;
      }
      if (msg.type === 'status') {
        socket.activity = msg.activity;
        for (const room of rooms.roomsOf(socket)) {
          const projectId = room.replace(/^project:/, '');
          if (projectId !== room) schedulePresence(rooms, projectId);
        }
        return;
      }
      void (async () => {
        let project: Awaited<ReturnType<typeof getProjectWithRole>>;
        try {
          project = await getProjectWithRole(userId, msg.projectId);
        } catch (err) {
          logger.error('ws-join-db-error', { error: err instanceof Error ? err.message : err });
          sendError(socket, 500, 'Internal error');
          return;
        }
        if (!project) {
          sendError(socket, 403, 'You do not have access to this project');
          return;
        }
        rooms.join(`project:${msg.projectId}`, socket);
        send(socket, {
          type: 'joined',
          projectId: msg.projectId,
          role: project.role,
          teamId: project.team_id,
        });
        schedulePresence(rooms, msg.projectId);
      })();
    };

    // Autentikasi dengan try/catch (audit 2026-08b, WS-1): kegagalan DB saat
    // verifySession tidak boleh menjadi unhandled rejection.
    void (async () => {
      try {
        const userId = await verifySession(parseSessionCookie(req.headers.cookie));
        if (!userId) {
          logger.info('ws-auth-rejected', { ip: req.socket.remoteAddress });
          socket.close(WS_CLOSE.UNAUTHORIZED, 'UNAUTHORIZED');
          return;
        }
        socket.userId = userId;
        authenticated = true;
        send(socket, { type: 'hello', userId });
        for (const data of queued.splice(0)) handleRawMessage(data);
      } catch (err) {
        logger.error('ws-auth-error', { error: err instanceof Error ? err.message : err });
        socket.close(WS_CLOSE.INTERNAL, 'INTERNAL');
      }
    })();

    socket.on('message', (data: RawData) => {
      if (!authenticated) {
        queued.push(data);
        return;
      }
      handleRawMessage(data);
    });

    socket.on('close', () => {
      const roomsLeft = rooms.leaveAll(socket);
      for (const room of roomsLeft) {
        const projectId = room.replace(/^project:/, '');
        if (projectId !== room) schedulePresence(rooms, projectId);
      }
    });

    socket.on('error', (err) => {
      logger.warn('ws-client-error', { error: err.message });
    });
  });

  const health = (socket: WebSocket) => {
    if (socket.isAlive === false) {
      socket.terminate();
      return;
    }
    socket.isAlive = false;
    socket.ping();
  };
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) health(socket);
  }, options.heartbeatMs ?? HEARTBEAT_MS);

  return {
    wss,
    close() {
      clearInterval(heartbeat);
      for (const timer of presenceTimers.values()) clearTimeout(timer);
      presenceTimers.clear();
      for (const socket of wss.clients) socket.close(1001, 'Server shutting down');
      wss.close();
      return wss.clients.size;
    },
  };
}
