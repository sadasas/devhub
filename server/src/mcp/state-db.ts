import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { pool } from '../db/pool.js';
import { stateSchema, type State } from '../schema/state.js';

async function findRow(projectId: string) {
  const result = await pool.query(
    'SELECT id, name, data FROM projects WHERE id = $1',
    [projectId],
  );
  return result.rows[0] as
    | { id: string; name: string; data: unknown }
    | undefined;
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
  const result = await pool.query(
    'UPDATE projects SET data = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING id',
    [projectId, JSON.stringify(state)],
  );
  if (!result.rows[0]) {
    throw new McpError(ErrorCode.InvalidParams, `Project not found: ${projectId}`);
  }
}
