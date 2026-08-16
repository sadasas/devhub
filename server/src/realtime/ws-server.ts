import type { Server } from 'node:http';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { z } from 'zod';
import { SESSION_COOKIE } from '../app.js';
import { verifySession } from '../auth/jwt.js';
import { getProjectWithRole, getTeamWithRole } from '../api/authz.js';
import { pool } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { chatRefSchema, insertMessage, messageJson } from '../lib/chat.js';
import type { RoomRegistry } from './rooms.js';

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
} as const;

const HEARTBEAT_MS = 30_000;

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

function send(socket: WebSocket, message: unknown): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function sendError(socket: WebSocket, code: number, message: string): void {
  send(socket, { type: 'error', code, message });
}

/**
 * Broadcasts a presence snapshot to a project room: every authenticated
 * member socket's userId, with display names resolved from the users
 * table. Best-effort — DB failures log and skip rather than kill the
 * connection.
 */
async function broadcastPresence(rooms: RoomRegistry, projectId: string): Promise<void> {
  const userIds = rooms
    .members(`project:${projectId}`)
    .map((s) => s.userId)
    .filter((id): id is string => Boolean(id));
  if (userIds.length === 0) return;
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
        activity: rooms
          .members(`project:${projectId}`)
          .find((s) => s.userId === userId)?.activity ?? null,
      })),
    });
  } catch (err) {
    logger.error('ws-presence-db-error', { error: err instanceof Error ? err.message : err });
  }
}

export function createRealtimeServer(
  httpServer: Server,
  rooms: RoomRegistry,
  options: RealtimeServerOptions = {},
): RealtimeServer {
  const wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

  wss.on('connection', (socket, req) => {
    socket.isAlive = true;
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    void (async () => {
      const userId = await verifySession(parseSessionCookie(req.headers.cookie));
      if (!userId) {
        logger.info('ws-auth-rejected', { ip: req.socket.remoteAddress });
        socket.close(WS_CLOSE.UNAUTHORIZED, 'UNAUTHORIZED');
        return;
      }
      socket.userId = userId;
      send(socket, { type: 'hello', userId });
    })();

    socket.on('message', (data: RawData) => {
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
          if (projectId !== room) void broadcastPresence(rooms, projectId);
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
          if (projectId !== room) void broadcastPresence(rooms, projectId);
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
        void broadcastPresence(rooms, msg.projectId);
      })();
    });

    socket.on('close', () => {
      const roomsLeft = rooms.leaveAll(socket);
      for (const room of roomsLeft) {
        const projectId = room.replace(/^project:/, '');
        if (projectId !== room) void broadcastPresence(rooms, projectId);
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
      for (const socket of wss.clients) socket.close(1001, 'Server shutting down');
      wss.close();
      return wss.clients.size;
    },
  };
}