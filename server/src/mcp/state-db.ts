import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { pool } from '../db/pool.js';
import { stateSchema, type State } from '../schema/state.js';
import { mergePrd, normalizePrd, type Prd, type PrdPatch } from '../schema/prd.js';
import { getMcpUserId } from './context.js';
import { getProjectWithRole } from '../api/authz.js';
import { broadcastSync } from '../realtime/broadcast.js';

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
  const result = await pool.query<{ id: string; version: number }>(
    'UPDATE projects SET data = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1 RETURNING id, version',
    [projectId, JSON.stringify(state)],
  );
  if (!result.rows[0]) {
    throw new McpError(ErrorCode.InvalidParams, `Project not found: ${projectId}`);
  }
  broadcastSync(projectId, result.rows[0].version);
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
