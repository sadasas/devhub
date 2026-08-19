import type {
  ApiCollection,
  ApiEndpoint,
  Decision,
  Issue,
  Milestone,
  State,
  Table,
  Task,
  TechEntry,
  TestCase,
  WhiteboardElement,
} from '../../lib/types';
import {
  DECISION_STATUS,
  ISSUE_SEVERITY,
  ISSUE_STATUS,
  MILESTONE_STATUS,
  TASK_PRIORITY,
  TASK_STATUS,
  TECH_CATEGORY,
  TECH_STATUS,
  TEST_CASE_STATUS,
} from '../../lib/labels';
import type { RefCardData } from './geometry';

/** Resolves live entity data for every ref element on a board. Null = entity missing/deleted. */
export function buildRefDataMap(
  elements: readonly WhiteboardElement[],
  state: Pick<State, 'tasks' | 'issues' | 'milestones' | 'testCases' | 'techEntries' | 'decisions' | 'tables' | 'apiCollections' | 'apiEndpoints'> | null,
): Map<string, RefCardData | null> {
  const m = new Map<string, RefCardData | null>();
  const tasks = state?.tasks ?? [];
  const issues = state?.issues ?? [];
  const milestones = state?.milestones ?? [];
  const testCases = state?.testCases ?? [];
  const techEntries = state?.techEntries ?? [];
  const decisions = state?.decisions ?? [];
  const tables = state?.tables ?? [];
  const apiCollections = state?.apiCollections ?? [];
  const apiEndpoints = state?.apiEndpoints ?? [];
  for (const el of elements) {
    if (el.kind !== 'ref') continue;
    const findRow = <T extends { id: string }>(rows: T[]) => rows.find((r) => r.id === el.entityId);
    switch (el.entity) {
      case 'tasks': {
        const t = findRow(tasks) as Task | undefined;
        if (!t) {
          m.set(el.id, null);
          break;
        }
        const milestone = t.milestoneId ? milestones.find((ms) => ms.id === t.milestoneId) : undefined;
        const blockers = (t.blockedBy ?? []).filter((id) => tasks.some((x) => x.id === id)).length;
        const tests = testCases.filter((tc) => tc.taskId === t.id).length;
        const counts: string[] = [];
        if (blockers > 0) counts.push(`${blockers} blocked`);
        if (tests > 0) counts.push(`${tests} tests`);
        m.set(el.id, {
          title: t.title,
          meta: `${TASK_STATUS[t.status].label} · ${TASK_PRIORITY[t.priority].label}`,
          sub: milestone ? milestone.name : undefined,
          labels: t.labels ?? [],
          hours: t.estimate != null || t.actualHours != null ? `${t.actualHours ?? 0}/${t.estimate ?? '—'}h` : undefined,
          counts,
          description: t.description ?? '',
        });
        break;
      }
      case 'issues': {
        const iss = findRow(issues) as Issue | undefined;
        if (!iss) {
          m.set(el.id, null);
          break;
        }
        const linked = iss.linkedTaskId ? tasks.find((t) => t.id === iss.linkedTaskId) : undefined;
        m.set(el.id, {
          title: iss.title,
          meta: `${ISSUE_SEVERITY[iss.severity].label} · ${ISSUE_STATUS[iss.status].label}`,
          sub: linked ? linked.title : undefined,
          labels: [],
          hours: undefined,
          counts: [],
          description: iss.description ?? '',
        });
        break;
      }
      case 'testCases': {
        const tc = findRow(testCases) as TestCase | undefined;
        if (!tc) {
          m.set(el.id, null);
          break;
        }
        const linkedTask = tc.taskId ? tasks.find((t) => t.id === tc.taskId) : undefined;
        const linkedIssue = !linkedTask && tc.issueId ? issues.find((i) => i.id === tc.issueId) : undefined;
        m.set(el.id, {
          title: tc.name,
          meta: TEST_CASE_STATUS[tc.status]?.label ?? String(tc.status ?? ''),
          sub: linkedTask?.title ?? linkedIssue?.title ?? undefined,
          labels: [],
          hours: undefined,
          counts: [],
          description: tc.steps ?? '',
        });
        break;
      }
      case 'milestones': {
        const ms = findRow(milestones) as Milestone | undefined;
        if (!ms) {
          m.set(el.id, null);
          break;
        }
        const taskCount = tasks.filter((t) => t.milestoneId === ms.id).length;
        m.set(el.id, {
          title: ms.name,
          meta: `${ms.version ? `${ms.version} · ` : ''}${MILESTONE_STATUS[ms.status]?.label ?? String(ms.status ?? '')}`,
          sub: undefined,
          labels: [],
          hours: undefined,
          counts: taskCount > 0 ? [`${taskCount} tasks`] : [],
          description: ms.changelog ?? '',
        });
        break;
      }
      case 'techEntries': {
        const te = findRow(techEntries) as TechEntry | undefined;
        if (!te) {
          m.set(el.id, null);
          break;
        }
        m.set(el.id, {
          title: te.name,
          meta: `${TECH_CATEGORY[te.category]?.label ?? String(te.category ?? '')} · ${TECH_STATUS[te.status]?.label ?? String(te.status ?? '')}`,
          sub: undefined,
          labels: [],
          hours: undefined,
          counts: te.version ? [te.version] : [],
          description: te.notes ?? '',
        });
        break;
      }
      case 'decisions': {
        const d = findRow(decisions) as Decision | undefined;
        if (!d) {
          m.set(el.id, null);
          break;
        }
        m.set(el.id, {
          title: d.title,
          meta: `${DECISION_STATUS[d.status]?.label ?? String(d.status ?? '')} · ${d.date ?? ''}`,
          sub: undefined,
          labels: [],
          hours: undefined,
          counts: [],
          description: d.context ?? '',
        });
        break;
      }
      case 'tables': {
        const tb = findRow(tables) as Table | undefined;
        if (!tb) {
          m.set(el.id, null);
          break;
        }
        m.set(el.id, {
          title: tb.name,
          meta: `${tb.columns.length} columns`,
          sub: undefined,
          labels: [],
          hours: undefined,
          counts: [],
          description: tb.comment ?? '',
        });
        break;
      }
      case 'apiCollections': {
        const c = findRow(apiCollections) as ApiCollection | undefined;
        if (!c) {
          m.set(el.id, null);
          break;
        }
        const endpointCount = apiEndpoints.filter((e) => e.collectionId === c.id).length;
        m.set(el.id, {
          title: c.name,
          meta: 'Collection',
          sub: undefined,
          labels: [],
          hours: undefined,
          counts: endpointCount > 0 ? [`${endpointCount} endpoints`] : [],
          description: c.description ?? '',
        });
        break;
      }
      case 'apiEndpoints': {
        const e = findRow(apiEndpoints) as ApiEndpoint | undefined;
        if (!e) {
          m.set(el.id, null);
          break;
        }
        const collection = e.collectionId ? apiCollections.find((c) => c.id === e.collectionId) : undefined;
        m.set(el.id, {
          title: e.name,
          meta: `${e.method} ${e.path}`,
          sub: collection ? collection.name : undefined,
          labels: [],
          hours: undefined,
          counts: [],
          description: e.description ?? '',
        });
        break;
      }
      default:
        m.set(el.id, null);
    }
  }
  return m;
}
