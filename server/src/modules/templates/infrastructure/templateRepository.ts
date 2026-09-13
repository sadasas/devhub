import { pool } from '../../../db/pool.js';
import type { TemplateRow, UpdateTemplateInput } from '../domain/templates.js';

// Parameterized SQL for owner-only project templates.
// Every read/write is scoped by owner_id so non-owners see 404 upstream.

const SELECT_BASE = `
  SELECT t.id, t.owner_id, t.name, t.description, t.state,
         t.created_by, t.created_at, t.updated_at
  FROM project_templates t
`;

export async function insertTemplate(
  ownerId: string,
  name: string,
  description: string,
  stateJson: string,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO project_templates (owner_id, name, description, state, created_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING id`,
    [ownerId, name, description, stateJson, ownerId],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Failed to save template');
  return id;
}

export async function listTemplatesByOwner(ownerId: string): Promise<TemplateRow[]> {
  const result = await pool.query<TemplateRow>(
    `${SELECT_BASE} WHERE t.owner_id = $1 ORDER BY t.updated_at DESC`,
    [ownerId],
  );
  return result.rows;
}

export async function findTemplateByOwner(
  templateId: string,
  ownerId: string,
): Promise<TemplateRow | undefined> {
  const result = await pool.query<TemplateRow>(
    `${SELECT_BASE} WHERE t.id = $1 AND t.owner_id = $2`,
    [templateId, ownerId],
  );
  return result.rows[0];
}

export async function updateTemplateByOwner(
  templateId: string,
  ownerId: string,
  patch: UpdateTemplateInput,
): Promise<TemplateRow | undefined> {
  const sets: string[] = [];
  const params: Array<string | number> = [];
  let index = 1;
  if (patch.name !== undefined) {
    sets.push(`name = $${index}`);
    params.push(patch.name);
    index += 1;
  }
  if (patch.description !== undefined) {
    sets.push(`description = $${index}`);
    params.push(patch.description);
    index += 1;
  }
  if (sets.length === 0) return findTemplateByOwner(templateId, ownerId);
  params.push(templateId, ownerId);
  const result = await pool.query<TemplateRow>(
    `UPDATE project_templates SET ${sets.join(', ')}
     WHERE id = $${index} AND owner_id = $${index + 1}
     RETURNING id, owner_id, name, description, state, created_by, created_at, updated_at`,
    params,
  );
  return result.rows[0];
}

export async function deleteTemplateByOwner(
  templateId: string,
  ownerId: string,
): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM project_templates WHERE id = $1 AND owner_id = $2',
    [templateId, ownerId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function insertProjectFromTemplate(
  teamId: string,
  name: string,
  description: string,
  stateJson: string,
): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO projects (team_id, name, description, data)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [teamId, name, description, stateJson],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('Failed to instantiate template');
  return id;
}
