import type { Task } from './types';

export type DagState = 'ready' | 'blocked' | 'done';

export interface DagResult {
  layers: Task[][];
  hasCycle: boolean;
  cyclePath: string[];
  externalBlocked: Map<string, string[]>;
  dagState: Map<string, DagState>;
  allBlocked: boolean;
}

function taskIsDone(t: Task): boolean {
  return t.status === 'done';
}

export function computeDag(tasks: readonly Task[]): DagResult {
  const byId = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  const dagState = new Map<string, DagState>();
  const externalBlocked = new Map<string, string[]>();

  for (const t of tasks) {
    if (taskIsDone(t)) {
      dagState.set(t.id, 'done');
      continue;
    }
    const blockers = t.blockedBy ?? [];
    const internalBlockers = blockers.filter((id) => byId.has(id));
    const external = blockers.filter((id) => !byId.has(id));
    if (external.length > 0) externalBlocked.set(t.id, external);
    const blocked = internalBlockers.some((id) => {
      const b = byId.get(id);
      return b ? !taskIsDone(b) : false;
    });
    dagState.set(t.id, blocked ? 'blocked' : 'ready');
  }

  // Kahn for layering (only non-done tasks determine depth)
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }
  for (const t of tasks) {
    // edge blocker -> t
    for (const bId of t.blockedBy ?? []) {
      if (!byId.has(bId)) continue;
      if (taskIsDone(byId.get(bId)!)) continue; // resolved blocker not an edge
      if (taskIsDone(t)) continue; // done tasks not in layers
      adj.get(bId)?.push(t.id);
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
    }
  }

  const activeTasks = tasks.filter((t) => !taskIsDone(t));
  const queue: string[] = [];
  const depth = new Map<string, number>();
  for (const t of activeTasks) {
    depth.set(t.id, 0);
    if ((inDegree.get(t.id) ?? 0) === 0) queue.push(t.id);
  }

  const visited: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited.push(id);
    const d = depth.get(id) ?? 0;
    for (const nxt of adj.get(id) ?? []) {
      const nd = Math.max(depth.get(nxt) ?? 0, d + 1);
      depth.set(nxt, nd);
      const deg = (inDegree.get(nxt) ?? 1) - 1;
      inDegree.set(nxt, deg);
      if (deg === 0) queue.push(nxt);
    }
  }

  const hasCycle = visited.length !== activeTasks.length;
  let cyclePath: string[] = [];
  if (hasCycle) {
    const remaining = activeTasks.map((t) => t.id).filter((id) => !visited.includes(id));
    cyclePath = remaining.slice(0, 4);
  }

  // group by depth
  const maxDepth = Math.max(0, ...Array.from(depth.values()));
  const layers: Task[][] = Array.from({ length: maxDepth + 1 }, () => []);
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedActive = [...activeTasks].sort((a, b) => {
    const da = depth.get(a.id) ?? 0;
    const db = depth.get(b.id) ?? 0;
    if (da !== db) return da - db;
    const pa = a.pinned ? 0 : 1;
    const pb = b.pinned ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const pra = priorityOrder[a.priority] ?? 9;
    const prb = priorityOrder[b.priority] ?? 9;
    if (pra !== prb) return pra - prb;
    const dueA = a.dueDate ?? '9999-99-99';
    const dueB = b.dueDate ?? '9999-99-99';
    if (dueA !== dueB) return dueA.localeCompare(dueB);
    return a.createdAt.localeCompare(b.createdAt);
  });

  for (const t of sortedActive) {
    if (hasCycle) {
      // fallback single layer sorted by blocked count
      layers[0]!.push(t);
    } else {
      const d = depth.get(t.id) ?? 0;
      layers[d]!.push(t);
    }
  }
  const finalLayers = hasCycle ? [sortedActive] : layers.filter((l) => l.length > 0);

  const allBlocked =
    activeTasks.length > 0 && activeTasks.every((t) => dagState.get(t.id) === 'blocked');

  return { layers: finalLayers, hasCycle, cyclePath, externalBlocked, dagState, allBlocked };
}
