import { ApiError } from '../../../shared/errors.js';
import { logger } from '../../../shared/logger.js';
import { stateSchema } from '../../projects/domain/state.js';
import {
  assertWrite,
  getProjectWithRole,
  getTeamWithRole,
  isUuid,
} from '../../authorization/application/authz.js';
import { assertProjectQuota } from '../../plans/application/quotaService.js';
import type {
  InstantiateTemplateInput,
  SaveTemplateInput,
  TemplateRow,
  UpdateTemplateInput,
} from '../domain/templates.js';
import {
  deleteTemplateByOwner,
  findTemplateByOwner,
  insertProjectFromTemplate,
  insertTemplate,
  listTemplatesByOwner,
  updateTemplateByOwner,
} from '../infrastructure/templateRepository.js';

// Owner-only template business logic. Routers stay thin; all permission
// checks live here. Non-owners always see 404 (never 403) so template
// existence is not leaked across accounts.

export function templateJson(row: TemplateRow, withState = false) {
  const json = {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
  if (withState) return { ...json, state: row.state };
  return json;
}

function assertTemplateId(templateId: string): void {
  if (!isUuid(templateId)) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
}

export async function saveTemplate(userId: string, input: SaveTemplateInput): Promise<TemplateRow> {
  const project = await getProjectWithRole(userId, input.projectId);
  if (!project) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  assertWrite(project.role);
  const parsed = stateSchema.safeParse(project.data);
  if (!parsed.success) {
    logger.error('State validation failed when saving template', {
      projectId: input.projectId,
      issues: parsed.error.issues,
    });
    throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
  }
  const id = await insertTemplate(userId, input.name, input.description, JSON.stringify(parsed.data));
  const row = await findTemplateByOwner(id, userId);
  if (!row) throw new ApiError(500, 'INTERNAL', 'Failed to save template');
  return row;
}

export async function listTemplates(userId: string): Promise<TemplateRow[]> {
  return listTemplatesByOwner(userId);
}

export async function getTemplate(userId: string, templateId: string): Promise<TemplateRow> {
  assertTemplateId(templateId);
  const row = await findTemplateByOwner(templateId, userId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  return row;
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  input: UpdateTemplateInput,
): Promise<TemplateRow> {
  assertTemplateId(templateId);
  if (input.name === undefined && input.description === undefined) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Nothing to update');
  }
  const row = await updateTemplateByOwner(templateId, userId, input);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  return row;
}

export async function deleteTemplate(userId: string, templateId: string): Promise<void> {
  assertTemplateId(templateId);
  const deleted = await deleteTemplateByOwner(templateId, userId);
  if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
}

export async function instantiateTemplate(
  userId: string,
  templateId: string,
  input: InstantiateTemplateInput,
): Promise<string> {
  assertTemplateId(templateId);
  // Owner-only: a template from another account reads as missing.
  const template = await findTemplateByOwner(templateId, userId);
  if (!template) throw new ApiError(404, 'NOT_FOUND', 'Template not found');
  // Target team must belong to the caller; cross-team instantiate is allowed
  // as long as the caller is a member with write access.
  const team = await getTeamWithRole(userId, input.teamId);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertWrite(team.role);
  await assertProjectQuota(input.teamId);
  const parsed = stateSchema.safeParse(template.state);
  if (!parsed.success) {
    throw new ApiError(500, 'INTERNAL', 'Stored template state is invalid');
  }
  return insertProjectFromTemplate(
    input.teamId,
    input.name?.trim() || template.name,
    input.description ?? template.description,
    JSON.stringify(parsed.data),
  );
}
