import { z } from 'zod';
import { getUserEmail } from './db.js';

export const CHAT_REF_ENTITIES = [
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
] as const;

export type ChatRefEntity = (typeof CHAT_REF_ENTITIES)[number];

export const chatRefSchema = z.object({
  entity: z.enum(CHAT_REF_ENTITIES),
  entityId: z.string().uuid(),
});

export const messageCreateSchema = z.object({
  content: z.string().trim().min(1, 'Message is required').max(4000),
  refs: z.array(chatRefSchema).max(10).default([]),
});

export const readStateSchema = z.object({
  lastReadAt: z.string().datetime(),
});

export interface MessageRow {
  id: string;
  team_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  refs: unknown;
  created_at: Date;
}

export function messageJson(row: MessageRow) {
  return {
    id: row.id,
    teamId: row.team_id,
    authorId: row.author_id,
    authorName: row.author_name,
    content: row.content,
    refs: row.refs,
    createdAt: row.created_at.toISOString(),
  };
}

export interface ChatRef {
  entity: ChatRefEntity;
  entityId: string;
}

interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: MessageRow[] }>;
}

export async function insertMessage(
  db: Queryable,
  teamId: string,
  authorId: string,
  content: string,
  refs: ChatRef[],
): Promise<MessageRow> {
  const authorName = await getUserEmail(authorId);
  const result = await db.query(
    `INSERT INTO team_messages (team_id, author_id, author_name, content, refs)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, team_id, author_id, author_name, content, refs, created_at`,
    [teamId, authorId, authorName, content, JSON.stringify(refs)],
  );
  return result.rows[0]!;
}