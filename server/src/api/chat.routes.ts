import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, getUserId } from '../auth/middleware/requireAuth.js';
import { ApiError } from '../app.js';
import { parseOrThrow } from '../lib/db.js';
import { getTeamWithRole, assertAdmin, isUuid } from './authz.js';
import {
  messageCreateSchema,
  readStateSchema,
  resolveRefsSchema,
  messageJson,
  insertMessage,
  resolveRefs,
  type MessageRow,
} from '../lib/chat.js';
import { broadcastTeamMessage } from '../realtime/broadcast.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.string().datetime().optional(),
});

export const chatRouter = Router();
chatRouter.use(requireAuth);

async function requireTeam(userId: string, teamId: string) {
  if (!isUuid(teamId)) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  const team = await getTeamWithRole(userId, teamId);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  return team;
}

chatRouter.get('/:teamId/messages', async (req, res) => {
  const userId = getUserId(req);
  await requireTeam(userId, req.params.teamId as string);
  const { limit, before } = parseOrThrow(listQuerySchema, req.query, 'Invalid query');

  const conditions: string[] = ['team_id = $1'];
  const params: unknown[] = [req.params.teamId];
  if (before) {
    params.push(before);
    conditions.push(`created_at < $${params.length}::timestamptz`);
  }
  params.push(limit);
  const result = await pool.query<MessageRow>(
    `SELECT id, team_id, author_id, author_name, content, refs, created_at
     FROM team_messages
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, id DESC
     LIMIT $${params.length}`,
    params,
  );

  const messages = result.rows.map(messageJson);
  const last = messages[messages.length - 1];
  res.json({ messages, nextCursor: last && messages.length === limit ? last.createdAt : null });
});

chatRouter.post('/:teamId/messages', async (req, res) => {
  const userId = getUserId(req);
  await requireTeam(userId, req.params.teamId as string);
  const { content, refs } = parseOrThrow(messageCreateSchema, req.body, 'Invalid message data');

  const row = await insertMessage(pool, req.params.teamId as string, userId, content, refs);
  const message = messageJson(row);
  broadcastTeamMessage(req.params.teamId as string, {
    type: 'message:new',
    teamId: req.params.teamId,
    message,
  });
  res.status(201).json({ message });
});

chatRouter.post('/:teamId/messages/resolve-refs', async (req, res) => {
  const userId = getUserId(req);
  await requireTeam(userId, req.params.teamId as string);
  const { refs } = parseOrThrow(resolveRefsSchema, req.body, 'Invalid refs');

  const resolved = await resolveRefs(pool, req.params.teamId as string, refs);
  res.json({ refs: resolved });
});

chatRouter.delete('/:teamId/messages/:messageId', async (req, res) => {
  const userId = getUserId(req);
  const team = await requireTeam(userId, req.params.teamId as string);
  const messageId = req.params.messageId as string;
  if (!isUuid(messageId)) throw new ApiError(404, 'NOT_FOUND', 'Message not found');

  const found = await pool.query<{ author_id: string | null }>(
    'SELECT author_id FROM team_messages WHERE id = $1 AND team_id = $2',
    [messageId, req.params.teamId],
  );
  const message = found.rows[0];
  if (!message) throw new ApiError(404, 'NOT_FOUND', 'Message not found');
  if (message.author_id !== userId) assertAdmin(team.role);

  await pool.query('DELETE FROM team_messages WHERE id = $1', [messageId]);
  res.status(200).json({ ok: true });
});

chatRouter.put('/:teamId/messages/read', async (req, res) => {
  const userId = getUserId(req);
  await requireTeam(userId, req.params.teamId as string);
  const { lastReadAt } = parseOrThrow(readStateSchema, req.body, 'Invalid read state');

  await pool.query(
    `INSERT INTO team_message_reads (team_id, user_id, last_read_at)
     VALUES ($1, $2, $3::timestamptz)
     ON CONFLICT (team_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
    [req.params.teamId, userId, lastReadAt],
  );
  res.status(200).json({ ok: true });
});

chatRouter.get('/:teamId/messages/unread', async (req, res) => {
  const userId = getUserId(req);
  await requireTeam(userId, req.params.teamId as string);

  const result = await pool.query<{ unread: number }>(
    `SELECT count(*)::int AS unread
     FROM team_messages m
     LEFT JOIN team_message_reads r ON r.team_id = m.team_id AND r.user_id = $2
     WHERE m.team_id = $1 AND m.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)`,
    [req.params.teamId, userId],
  );
  res.json({ unread: result.rows[0]?.unread ?? 0 });
});