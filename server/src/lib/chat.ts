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

export const resolveRefsSchema = z.object({
  refs: z.array(chatRefSchema).min(1).max(10),
});

export interface ChatResolvedRef {
  entity: ChatRefEntity;
  entityId: string;
  projectId: string | null;
  title: string | null;
}

interface ResolvedRow {
  id: string;
  data: unknown;
}

function refTitle(item: Record<string, unknown>, entity: ChatRefEntity, state: Record<string, unknown>): string | null {
  if (entity === 'relations') {
    const fromTableId = String(item.fromTableId ?? '');
    const toTableId = String(item.toTableId ?? '');
    const tables = (state.tables as Array<Record<string, unknown>> | undefined) ?? [];
    const fromName = tables.find((t) => t.id === fromTableId)?.name ?? fromTableId;
    const toName = tables.find((t) => t.id === toTableId)?.name ?? toTableId;
    return `${fromName}.${String(item.fromColumnId ?? '')} → ${toName}.${String(item.toColumnId ?? '')}`;
  }
  if (entity === 'schemaVersions') {
    const version = item.version;
    return typeof version === 'string' && version ? version : null;
  }
  const title = item.title;
  const name = item.name;
  const value = entity === 'tasks' || entity === 'issues' || entity === 'decisions' ? title : name;
  return typeof value === 'string' && value ? value : null;
}

export async function resolveRefs(db: Queryable, teamId: string, refs: ChatRef[]): Promise<ChatResolvedRef[]> {
  const projects = await db.query('SELECT id, data FROM projects WHERE team_id = $1', [teamId]);
  const found = new Map<string, { projectId: string; title: string }>();
  for (const row of projects.rows as unknown as ResolvedRow[]) {
    const parsed = z
      .object({
        tasks: z.array(z.unknown()),
        issues: z.array(z.unknown()),
        testCases: z.array(z.unknown()),
        techEntries: z.array(z.unknown()),
        tables: z.array(z.unknown()),
        relations: z.array(z.unknown()),
        schemaVersions: z.array(z.unknown()),
        decisions: z.array(z.unknown()),
        milestones: z.array(z.unknown()),
        apiCollections: z.array(z.unknown()),
        apiEndpoints: z.array(z.unknown()),
        whiteboards: z.array(z.unknown()),
      })
      .safeParse(row.data);
    if (!parsed.success) continue;
    const state = parsed.data as unknown as Record<string, Array<Record<string, unknown>>>;
    for (const ref of refs) {
      if (found.has(`${ref.entity}:${ref.entityId}`)) continue;
      const items = state[ref.entity] ?? [];
      const item = items.find((it) => it.id === ref.entityId);
      if (!item) continue;
      const title = refTitle(item, ref.entity, state);
      if (title) found.set(`${ref.entity}:${ref.entityId}`, { projectId: row.id, title });
    }
  }
  return refs.map((ref) => {
    const hit = found.get(`${ref.entity}:${ref.entityId}`);
    return { entity: ref.entity, entityId: ref.entityId, projectId: hit?.projectId ?? null, title: hit?.title ?? null };
  });
}