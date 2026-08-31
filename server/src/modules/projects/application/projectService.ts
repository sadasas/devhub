import { ApiError } from '../../../shared/errors.js';
import { logger } from '../../../shared/logger.js';
import { pool } from '../../../db/pool.js';
import { z } from 'zod';
import { parseOrThrow } from '../../../shared/db.js';
import { stateSchema, projectStatus, emptyState, type Milestone, type State } from '../domain/state.js';
import { mergePrd, normalizePrd, prdPatchSchema, type Prd, type PrdPatch } from '../domain/prd.js';
import { normalizeTabs, publicTabsSchema } from '../domain/sharing.js';
import {
  assertAdmin,
  assertWrite,
  getProjectWithRole,
  getTeamWithRole,
} from '../../authorization/application/authz.js';
import { recordActivity } from '../../activity/application/activity.js';
import { assertProjectQuota } from '../../plans/application/quotaService.js';
import {
  deleteProject as repoDeleteProject,
  findImportTeam,
  insertImportedProject,
  insertProject,
  listProjects,
  listProjectStats,
  restoreProjectState,
  restoreProjectStateUnconditional,
  updateProjectMeta,
  updateProjectState,
  type ProjectMetaPatch,
  type ProjectRow,
} from '../infrastructure/projectRepository.js';

export interface ProjectStats {
  totalTasks: number;
  doneTasks: number;
  openIssues: number;
  outdatedDeps: number;
  overdueTasks: number;
  totalMilestones: number;
  releasedMilestones: number;
  nextMilestone: Milestone | null;
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function isOverdueTask(task: State['tasks'][number], todayStr: string): boolean {
  if (task.status === 'done') return false;
  const due = task.dueDate;
  if (!due) return false;
  const dueStr = toDateOnly(due);
  return dueStr < todayStr;
}

export function computeProjectStats(state: State): ProjectStats {
  const now = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = state.milestones
    .filter((m) => m.status !== 'released' && m.targetDate && Date.parse(m.targetDate) >= now)
    .sort((a, b) => Date.parse(a.targetDate!) - Date.parse(b.targetDate!));
  return {
    totalTasks: state.tasks.length,
    doneTasks: state.tasks.filter((t) => t.status === 'done').length,
    openIssues: state.issues.filter((i) => !['resolved', 'wontfix'].includes(i.status)).length,
    outdatedDeps: state.techEntries.filter((t) => t.status !== 'current').length,
    overdueTasks: state.tasks.filter((t) => isOverdueTask(t, todayStr)).length,
    totalMilestones: state.milestones.length,
    releasedMilestones: state.milestones.filter((m) => m.status === 'released').length,
    nextMilestone: upcoming[0] ?? null,
  };
}

export interface DailyStat {
  date: string;
  created: number;
  done: number;
}

export function computeDailyStatsForStates(states: Array<{ state: State }>, days: number): DailyStat[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr + 'T00:00:00.000Z');
  const dates: string[] = [];
  const map = new Map<string, DailyStat>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const ds = d.toISOString().slice(0, 10);
    dates.push(ds);
    map.set(ds, { date: ds, created: 0, done: 0 });
  }
  const allowed = new Set(dates);
  for (const { state } of states) {
    for (const t of state.tasks) {
      const cDate = t.createdAt ? toDateOnly(t.createdAt) : null;
      if (cDate && allowed.has(cDate)) {
        map.get(cDate)!.created += 1;
      }
      if (t.status === 'done') {
        const doneDateRaw = t.completedAt ?? t.updatedAt;
        const dDate = doneDateRaw ? toDateOnly(doneDateRaw) : null;
        if (dDate && allowed.has(dDate)) {
          map.get(dDate)!.done += 1;
        }
      }
    }
  }
  return dates.map((d) => map.get(d)!);
}

export interface NextUpTask {
  projectId: string;
  projectName: string;
  taskId: string;
  title: string;
  dueDate: string;
  priority: State['tasks'][number]['priority'];
  status: State['tasks'][number]['status'];
}

const priorityRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function computeNextUpForStates(
  rows: Array<{ id: string; name: string; state: State }>,
  userId: string,
  limit: number,
): NextUpTask[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  const out: NextUpTask[] = [];
  for (const { id, name, state } of rows) {
    for (const t of state.tasks) {
      if (t.status === 'done') continue;
      if (!t.dueDate) continue;
      if (t.assigneeId !== userId) continue;
      const dueStr = toDateOnly(t.dueDate);
      if (dueStr > todayStr) continue;
      out.push({
        projectId: id,
        projectName: name,
        taskId: t.id,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
      });
    }
  }
  out.sort((a, b) => {
    const d = a.dueDate.localeCompare(b.dueDate);
    if (d !== 0) return d;
    const pr = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
    if (pr !== 0) return pr;
    return a.title.localeCompare(b.title);
  });
  return out.slice(0, limit);
}

export function projectJson(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    version: row.version,
    tabs: normalizeTabs(row.public_tabs),
    prd: normalizePrd(row.prd),
    teamId: row.team_id,
    teamName: row.team_name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listProjectsForUser(userId: string): Promise<ProjectRow[]> {
  return listProjects(userId);
}

export async function getProject(userId: string, projectId: string): Promise<ProjectRow> {
  const row = await getProjectWithRole(userId, projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  return row;
}

export async function getProjectStats(userId: string): Promise<Array<{ projectId: string } & ProjectStats>> {
  const rows = await listProjectStats(userId);
  return rows.map((row) => {
    const parsed = stateSchema.safeParse(row.data);
    return { projectId: row.id, ...computeProjectStats(parsed.success ? parsed.data : emptyState) };
  });
}

export async function getProjectDailyStats(userId: string, days: number): Promise<DailyStat[]> {
  const rows = await listProjectStats(userId);
  const states = rows.map((r) => {
    const parsed = stateSchema.safeParse(r.data);
    return { state: parsed.success ? parsed.data : emptyState };
  });
  return computeDailyStatsForStates(states, days);
}

export async function getProjectNextUp(userId: string, limit: number): Promise<NextUpTask[]> {
  const rows = await listProjectStats(userId);
  // need project name; listProjectStats only returns id+data, so fetch name via listProjects
  const metaRows = await listProjects(userId);
  const nameById = new Map(metaRows.map((r) => [r.id, r.name]));
  const enriched = rows.map((r) => {
    const parsed = stateSchema.safeParse(r.data);
    return { id: r.id, name: nameById.get(r.id) ?? r.id, state: parsed.success ? parsed.data : emptyState };
  });
  return computeNextUpForStates(enriched, userId, limit);
}

export interface CreateProjectInput {
  name: string;
  description: string;
  teamId: string;
  prd?: Prd;
}

export async function createProject(userId: string, input: CreateProjectInput): Promise<ProjectRow> {
  const team = await getTeamWithRole(userId, input.teamId);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertWrite(team.role);
  await assertProjectQuota(input.teamId);
  const id = await insertProject(
    input.teamId,
    input.name,
    input.description,
    JSON.stringify(mergePrd(input.prd)),
    JSON.stringify(emptyState),
  );
  const row = await getProjectWithRole(userId, id);
  return row!;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: string;
  visibility?: string;
  publicTabs?: unknown;
  prd?: PrdPatch;
}

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(5_000).optional(),
  status: projectStatus.optional(),
  visibility: z.enum(['private', 'public']).optional(),
  publicTabs: publicTabsSchema.optional(),
  prd: prdPatchSchema.optional(),
});

export async function updateProject(
  userId: string,
  projectId: string,
  body: unknown,
): Promise<{ row: ProjectRow; version: number }> {
  const row = await getProjectWithRole(userId, projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  assertWrite(row.role);
  const input = parseOrThrow(updateProjectSchema, body, 'Invalid project data');
  if (row.status === 'archived') {
    const hasOther = input.name !== undefined || input.description !== undefined || input.visibility !== undefined || input.publicTabs !== undefined || input.prd !== undefined;
    const isRestore = input.status === 'active';
    const isNoopArchive = input.status === 'archived' && !hasOther;
    if (!isRestore && !isNoopArchive) {
      throw new ApiError(403, 'ARCHIVED', 'Project is archived — restore to edit');
    }
  }
  if (input.visibility !== undefined) assertAdmin(row.role);
  if (input.publicTabs !== undefined) assertAdmin(row.role);
  const patch: ProjectMetaPatch = {
    name: input.name,
    description: input.description,
    status: input.status,
    visibility: input.visibility,
    publicTabs: input.publicTabs,
    prd: input.prd !== undefined ? JSON.stringify(mergePrd(input.prd, normalizePrd(row.prd))) : null,
  };
  const updated = await updateProjectMeta(projectId, patch);
  if (!updated) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const fresh = await getProjectWithRole(userId, projectId);
  return { row: fresh!, version: fresh!.version };
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  const row = await getProjectWithRole(userId, projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  assertAdmin(row.role);
  const deleted = await repoDeleteProject(projectId);
  if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
}

export async function getProjectState(
  userId: string,
  projectId: string,
): Promise<{ state: State; version: number }> {
  const row = await getProjectWithRole(userId, projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const parsed = stateSchema.safeParse(row.data);
  if (!parsed.success) {
    logger.error('State validation failed on read', { projectId });
    throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
  }
  return { state: parsed.data, version: row.version };
}

const putStateSchema = z.object({
  state: stateSchema,
  version: z.number().int().positive(),
});

export async function putProjectState(
  userId: string,
  projectId: string,
  body: unknown,
  ifMatch?: string,
): Promise<number> {
  const row = await getProjectWithRole(userId, projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  assertWrite(row.role);
  if (row.status === 'archived') {
    throw new ApiError(403, 'ARCHIVED', 'Project is archived — restore to edit');
  }
  const { state, version: bodyVersion } = parseOrThrow(putStateSchema, body, 'Invalid state payload');
  // If-Match didukung sebagai alternatif version di body (audit 2026-08b, REST-2)
  const version = typeof ifMatch === 'string' && ifMatch.trim().length > 0
    ? Number.parseInt(ifMatch.trim().replace(/^"(.*)"$/, '$1'), 10)
    : bodyVersion;
  const currentParsed = stateSchema.safeParse(row.data);
  if (!currentParsed.success) {
    throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
  }
  const updated = await updateProjectState(projectId, JSON.stringify(state), version);
  if (!updated) {
    const fresh = await getProjectWithRole(userId, projectId);
    throw new ApiError(409, 'CONFLICT', 'The project was modified by someone else. Reload to see the latest version.', {
      current: { version: fresh?.version ?? null },
    });
  }
  await recordActivity(pool, projectId, userId, currentParsed.data, state);
  return updated.version;
}

export interface ExportDocument {
  meta: {
    app: string;
    version: string;
    exportedAt: string;
    projectId: string;
    stateVersion: number;
  };
  state: State;
}

export async function exportProject(
  userId: string,
  projectId: string,
): Promise<{ document: ExportDocument; safeName: string }> {
  const row = await getProjectWithRole(userId, projectId);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Project not found');
  const parsed = stateSchema.safeParse(row.data);
  if (!parsed.success) {
    throw new ApiError(500, 'INTERNAL', 'Stored state is invalid');
  }
  const document: ExportDocument = {
    meta: {
      app: 'devhub',
      version: '0.1.0',
      exportedAt: new Date().toISOString(),
      projectId,
      stateVersion: row.version,
    },
    state: parsed.data,
  };
  const safeName = row.name.replace(/[^a-z0-9-_]/gi, '_').toLowerCase() || 'project';
  return { document, safeName };
}

export interface ImportProjectInput {
  meta: { projectId: string; stateVersion?: number };
  state: State;
  teamId?: string;
}

export async function importProject(
  userId: string,
  input: ImportProjectInput,
): Promise<{ projectId: string; restored: boolean; version?: number }> {
  const { meta, state, teamId } = input;
  const existing = await getProjectWithRole(userId, meta.projectId);
  if (existing) {
    assertWrite(existing.role);
    if (existing.status === 'archived') {
      throw new ApiError(403, 'ARCHIVED', 'Project is archived — restore before importing');
    }
    // Restore conditional pada versi state ekspor (audit 2026-08b, REST-4/DB-11):
    // ekspor lama (tanpa stateVersion) tetap restore unconditional untuk kompatibilitas.
    if (meta.stateVersion !== undefined) {
      const restored = await restoreProjectState(meta.projectId, JSON.stringify(state), meta.stateVersion);
      if (!restored) {
        const fresh = await getProjectWithRole(userId, meta.projectId);
        throw new ApiError(409, 'CONFLICT', 'Project changed since the export; reload and re-export before restoring.', {
          current: { version: fresh?.version ?? null },
        });
      }
      const existingParsed = stateSchema.safeParse(existing.data);
      const before = existingParsed.success ? existingParsed.data : state;
      await recordActivity(pool, meta.projectId, userId, before, state);
      return { projectId: meta.projectId, restored: true, version: restored.version };
    }
    await restoreProjectStateUnconditional(meta.projectId, JSON.stringify(state));
    return { projectId: meta.projectId, restored: true, version: existing.version + 1 };
  }
  let targetTeamId = teamId;
  if (!targetTeamId) {
    targetTeamId = await findImportTeam(userId);
  }
  if (!targetTeamId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'No team available to import into');
  }
  const team = await getTeamWithRole(userId, targetTeamId);
  if (!team) throw new ApiError(404, 'NOT_FOUND', 'Team not found');
  assertWrite(team.role);
  await assertProjectQuota(targetTeamId);
  const name = `Imported ${new Date().toISOString().slice(0, 10)}`;
  const id = await insertImportedProject(targetTeamId, name, 'Imported from export document', JSON.stringify(state));
  return { projectId: id, restored: false };
}