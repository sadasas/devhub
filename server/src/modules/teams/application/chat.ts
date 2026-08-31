import { z } from 'zod';
import { getUserDisplayName } from '../../authorization/application/authz.js';
import type { ChatRef, ChatRefEntity } from '../domain/chat.js';

export interface MessageRow {
  id: string;
  team_id: string;
  author_id: string | null;
  author_name: string;
  content: string;
  refs: unknown;
  created_at: Date;
  author_avatar_url?: string | null;
}

export function messageJson(row: MessageRow) {
  return {
    id: row.id,
    teamId: row.team_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatarUrl: (row as { author_avatar_url?: string | null }).author_avatar_url ?? null,
    content: row.content,
    refs: row.refs,
    createdAt: row.created_at.toISOString(),
  };
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
  const authorName = await getUserDisplayName(authorId);
  // Avatar diambil fresh dari users agar foto profil terbaru langsung terlihat di chat
  const avatarResult = await db.query(
    'SELECT avatar_url FROM users WHERE id = $1',
    [authorId],
  ).catch(() => ({ rows: [] as { avatar_url: string | null }[] }));
  const avatarUrl = (avatarResult.rows[0] as { avatar_url?: string | null } | undefined)?.avatar_url ?? null;
  const result = await db.query(
    `INSERT INTO team_messages (team_id, author_id, author_name, content, refs)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, team_id, author_id, author_name, content, refs, created_at`,
    [teamId, authorId, authorName, content, JSON.stringify(refs)],
  );
  const row = result.rows[0]! as MessageRow;
  (row as { author_avatar_url?: string | null }).author_avatar_url = avatarUrl;
  return row;
}

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
  // Cap proyek yang di-scan ke yang terbaru (audit 2026-08b, DB-10): resolve-refs
  // tidak perlu memuat state seluruh proyek team per request.
  const projects = await db.query(
    'SELECT id, data FROM projects WHERE team_id = $1 ORDER BY updated_at DESC LIMIT 5',
    [teamId],
  );
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