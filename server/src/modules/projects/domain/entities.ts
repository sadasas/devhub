import { z } from 'zod';
import { nowIso } from '../../../shared/ids.js';
import { deriveActualHours } from './hours.js';
import {
  taskSchema,
  issueSchema,
  testCaseSchema,
  techEntrySchema,
  tableSchema,
  relationSchema,
  schemaVersionSchema,
  decisionSchema,
  milestoneSchema,
  apiCollectionSchema,
  apiEndpointSchema,
  whiteboardSchema,
  type State,
} from './state.js';

export interface EntityConfig {
  key: keyof State;
  label: string;
  createSchema: z.ZodObject<z.ZodRawShape>;
  patchSchema: z.ZodObject<z.ZodRawShape>;
  onDelete?: (state: State, id: string) => void;
}

function mk(
  key: keyof State,
  label: string,
  schema: z.ZodObject<z.ZodRawShape>,
  onDelete?: (state: State, id: string) => void,
): EntityConfig {
  const createSchema = schema.omit({ createdAt: true, updatedAt: true });
  return { key, label, createSchema, patchSchema: createSchema.partial(), onDelete };
}

export const ENTITIES: EntityConfig[] = [
  mk('tasks', 'Task', taskSchema, (state, id) => {
    state.issues = state.issues.map((iss) =>
      iss.linkedTaskId === id ? { ...iss, linkedTaskId: null } : iss,
    );
    state.testCases = state.testCases.map((tc) =>
      tc.taskId === id ? { ...tc, taskId: null } : tc,
    );
    state.tasks = state.tasks.map((t) =>
      t.blockedBy.includes(id) ? { ...t, blockedBy: t.blockedBy.filter((b) => b !== id) } : t,
    );
    state.whiteboards = state.whiteboards.map((w) => ({
      ...w,
      elements: w.elements.filter((el) => !(el.kind === 'ref' && el.entity === 'tasks' && el.entityId === id)),
    }));
  }),
  mk('issues', 'Issue', issueSchema, (state, id) => {
    state.whiteboards = state.whiteboards.map((w) => ({
      ...w,
      elements: w.elements.filter((el) => !(el.kind === 'ref' && el.entity === 'issues' && el.entityId === id)),
    }));
  }),
  mk('testCases', 'Test case', testCaseSchema),
  mk('techEntries', 'Tech entry', techEntrySchema),
  mk('tables', 'Table', tableSchema, (state, id) => {
    state.relations = state.relations.filter((r) => r.fromTableId !== id && r.toTableId !== id);
  }),
  mk('relations', 'Relation', relationSchema),
  mk('schemaVersions', 'Schema version', schemaVersionSchema),
  mk('decisions', 'Decision', decisionSchema),
  mk('milestones', 'Milestone', milestoneSchema, (state, id) => {
    state.tasks = state.tasks.map((t) =>
      t.milestoneId === id ? { ...t, milestoneId: null } : t,
    );
    state.decisions = state.decisions.map((d) =>
      (d as unknown as { milestoneId?: string | null }).milestoneId === id
        ? { ...d, milestoneId: null }
        : d,
    );
    state.schemaVersions = state.schemaVersions.map((v) =>
      (v as unknown as { milestoneId?: string | null }).milestoneId === id
        ? { ...v, milestoneId: null }
        : v,
    );
  }),
  mk('apiCollections', 'API collection', apiCollectionSchema, (state, id) => {
    state.apiEndpoints = state.apiEndpoints.map((e) =>
      e.collectionId === id ? { ...e, collectionId: null } : e,
    );
  }),
  mk('apiEndpoints', 'API endpoint', apiEndpointSchema),
  mk('whiteboards', 'Whiteboard', whiteboardSchema),
];

export type EntityRow = { id: string; createdAt: string; updatedAt: string } & Record<string, unknown>;

export function itemsOf(state: State, key: keyof State): EntityRow[] {
  return state[key] as unknown as EntityRow[];
}

export function deriveTaskPatch(
  before: EntityRow,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const after: Record<string, unknown> = { ...patch };
  const wasDone = before.status === 'done';
  if (patch.status === 'done' && !wasDone) {
    if (after.completedAt === undefined) after.completedAt = nowIso();
    if (after.completedAt != null && after.actualHours === undefined && typeof before.createdAt === 'string') {
      after.actualHours = deriveActualHours({
        completedAt: String(after.completedAt),
        createdAt: before.createdAt,
        startDate: (after.startDate ?? before.startDate) as string | null | undefined,
      });
    }
  } else if (patch.status !== undefined && patch.status !== 'done' && wasDone) {
    after.completedAt = null;
  }
  return after;
}

export function sorted(items: EntityRow[]): EntityRow[] {
  return [...items].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}