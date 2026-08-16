import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { pool } from '../db/pool.js';
import { stateSchema, type State } from '../schema/state.js';
import { mergePrd, normalizePrd, type Prd, type PrdPatch } from '../schema/prd.js';
import { getMcpUserId } from './context.js';
import { getProjectWithRole } from '../api/authz.js';
import { broadcastActivity, broadcastSync } from '../realtime/broadcast.js';
import { diffStateDrafts, insertActivity, pruneActivity, type ActivityEntry } from '../lib/activity.js';

async function findRow(projectId: string) {
  const row = await getProjectWithRole(getMcpUserId(), projectId);
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    prd: row.prd,
    data: row.data,
  };
}

export async function loadState(projectId: string): Promise<State> {
  const row = await findRow(projectId);
  if (!row) {
    throw new McpError(ErrorCode.InvalidParams, `Project not found: ${projectId}`);
  }
  const parsed = stateSchema.safeParse(row.data);
  if (!parsed.success) {
    throw new McpError(ErrorCode.InternalError, `Stored state is invalid for project ${projectId}`);
  }
  return parsed.data;
}

export async function saveState(projectId: string, state: State): Promise<void> {
  const row = await getProjectWithRole(getMcpUserId(), projectId);
  if (!row) {
    throw new McpError(ErrorCode.InvalidParams, `Project not found: ${projectId}`);
  }
  if (row.role === 'viewer') {
    throw new McpError(ErrorCode.InvalidParams, `No write access to project ${projectId}`);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query<{ data: unknown }>(
      'SELECT data FROM projects WHERE id = $1 FOR UPDATE',
      [projectId],
    );
    const current = locked.rows[0];
    if (!current) {
      throw new McpError(ErrorCode.InvalidParams, `Project not found: ${projectId}`);
    }
    const parsed = stateSchema.safeParse(current.data);
    if (!parsed.success) {
      throw new McpError(ErrorCode.InternalError, `Stored state is invalid for project ${projectId}`);
    }
    const result = await client.query<{ version: number }>(
      'UPDATE projects SET data = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1 RETURNING version',
      [projectId, JSON.stringify(state)],
    );
    const entries: ActivityEntry[] = [];
    const drafts = diffStateDrafts(parsed.data, state);
    if (drafts.length > 0) {
      const userId = getMcpUserId();
      const authorResult = await client.query<{ displayName: string }>(
        'SELECT display_name AS "displayName" FROM users WHERE id = $1',
        [userId],
      );
      const authorName = authorResult.rows[0]?.displayName ?? '';
      for (const draft of drafts) {
        const entry = await insertActivity(client, {
          projectId,
          draft,
          authorId: userId,
          authorName,
        });
        if (entry) entries.push(entry);
      }
      await pruneActivity(client, projectId);
    }
    await client.query('COMMIT');
    const version = result.rows[0]?.version;
    if (!version) {
      throw new McpError(ErrorCode.InternalError, 'Failed to persist state');
    }
    broadcastSync(projectId, version);
    for (const entry of entries) {
      broadcastActivity(projectId, entry);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function loadProjectSnapshot(projectId: string): Promise<{ state: State; meta: { name: string; description: string; status: string; prd: Prd } }> {
  const row = await findRow(projectId);
  if (!row) {
    throw new McpError(ErrorCode.InvalidParams, `Project not found: ${projectId}`);
  }
  const parsed = stateSchema.safeParse(row.data);
  if (!parsed.success) {
    throw new McpError(ErrorCode.InternalError, `Stored state is invalid for project ${projectId}`);
  }
  return {
    state: parsed.data,
    meta: { name: row.name, description: row.description, status: row.status, prd: normalizePrd(row.prd) },
  };
}

export async function updatePrd(projectId: string, patch: PrdPatch): Promise<Prd> {
  const row = await getProjectWithRole(getMcpUserId(), projectId);
  if (!row) {
    throw new McpError(ErrorCode.InvalidParams, `Project not found: ${projectId}`);
  }
  if (row.role === 'viewer') {
    throw new McpError(ErrorCode.InvalidParams, `No write access to project ${projectId}`);
  }
  const merged = mergePrd(patch, normalizePrd(row.prd));
  const result = await pool.query(
    'UPDATE projects SET prd = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING id',
    [projectId, JSON.stringify(merged)],
  );
  if (!result.rows[0]) {
    throw new McpError(ErrorCode.InvalidParams, `Project not found: ${projectId}`);
  }
  return merged;
}
