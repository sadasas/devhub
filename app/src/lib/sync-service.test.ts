import { describe, expect, it } from 'vitest';
import { type PendingMutation } from './storage-provider';
import { reconcileQueue } from './sync-service';
import type { State } from './types';

const OLD = '2026-01-01T00:00:00.000Z';
const NEW = '2026-02-01T00:00:00.000Z';
const NEWER = '2026-03-01T00:00:00.000Z';

function makeMutation(overrides: Partial<PendingMutation> = {}): PendingMutation {
  return {
    key: 'tasks:t1',
    entity: 'tasks',
    op: 'update',
    id: 't1',
    payload: { id: 't1', updatedAt: NEW },
    ...overrides,
  };
}

function makeTask(updatedAt: string): State['tasks'][number] {
  return {
    id: 't1',
    title: 'Task',
    status: 'todo',
    priority: 'medium',
    labels: [],
    blockedBy: [],
    description: '',
    createdAt: OLD,
    updatedAt,
  };
}

function makeState(serverUpdatedAt: string): State {
  return {
    tasks: [makeTask(serverUpdatedAt)],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

describe('reconcileQueue (LWW per updatedAt)', () => {
  it('keeps creates for entities absent on the server', () => {
    const state = makeState(NEWER);
    state.tasks = [];
    const { keep, dropped } = reconcileQueue([makeMutation({ op: 'create' })], state);

    expect(keep).toEqual([expect.objectContaining({ op: 'create' })]);
    expect(dropped).toEqual([]);
  });

  it('downgrades a create to update when the local entity is newer', () => {
    const { keep, dropped } = reconcileQueue(
      [makeMutation({ op: 'create' })],
      makeState(OLD),
      makeState(NEW),
    );

    expect(keep).toEqual([expect.objectContaining({ op: 'update', id: 't1' })]);
    expect(dropped).toEqual([]);
  });

  it('drops a create when the server entity is newer or equal', () => {
    const newer = reconcileQueue([makeMutation({ op: 'create' })], makeState(NEWER), makeState(OLD));
    expect(newer.keep).toEqual([]);
    expect(newer.dropped).toEqual(['tasks:t1']);

    const equal = reconcileQueue(
      [makeMutation({ op: 'create' })],
      makeState(NEW),
      makeState(NEW),
    );
    expect(equal.keep).toEqual([]);
    expect(equal.dropped).toEqual(['tasks:t1']);
  });

  it('keeps an update when the local entity is strictly newer', () => {
    const { keep, dropped } = reconcileQueue(
      [makeMutation({ payload: { id: 't1' } })],
      makeState(OLD),
      makeState(NEW),
    );

    expect(keep).toEqual([makeMutation({ payload: { id: 't1' } })]);
    expect(dropped).toEqual([]);
  });

  it('drops an update when the server is newer or equal', () => {
    const newer = reconcileQueue([makeMutation()], makeState(NEWER), makeState(NEW));
    expect(newer.keep).toEqual([]);
    expect(newer.dropped).toEqual(['tasks:t1']);

    const equal = reconcileQueue([makeMutation()], makeState(NEW), makeState(NEW));
    expect(equal.keep).toEqual([]);
    expect(equal.dropped).toEqual(['tasks:t1']);
  });

  it('drops an update when the entity no longer exists on the server', () => {
    const state = makeState(NEWER);
    state.tasks = [];
    const { keep, dropped } = reconcileQueue([makeMutation()], state, makeState(NEWER));

    expect(keep).toEqual([]);
    expect(dropped).toEqual(['tasks:t1']);
  });

  it('drops an update with no local timestamp anywhere', () => {
    const { keep, dropped } = reconcileQueue(
      [makeMutation({ payload: { id: 't1' } })],
      makeState(OLD),
    );

    expect(keep).toEqual([]);
    expect(dropped).toEqual(['tasks:t1']);
  });

  it('always keeps deletes (delete-wins)', () => {
    const { keep, dropped } = reconcileQueue(
      [makeMutation({ op: 'delete', payload: undefined })],
      makeState(NEWER),
      makeState(OLD),
    );

    expect(keep).toEqual([expect.objectContaining({ op: 'delete' })]);
    expect(dropped).toEqual([]);
  });

  it('resolves a mixed batch keeping order and reporting dropped keys', () => {
    const batch: PendingMutation[] = [
      makeMutation({ key: 'tasks:t1' }),
      makeMutation({ key: 'tasks:t2', id: 't2', op: 'create' }),
      makeMutation({ key: 'tasks:t3', id: 't3', op: 'delete', payload: undefined }),
    ];
    const state = makeState(NEWER);
    state.tasks.push({ ...makeTask(NEWER), id: 't2' });
    const local = makeState(NEW);
    local.tasks.push({ ...makeTask(NEW), id: 't2' });

    const { keep, dropped } = reconcileQueue(batch, state, local);

    expect(keep.map((m) => m.key)).toEqual(['tasks:t3']);
    expect(dropped).toEqual(['tasks:t1', 'tasks:t2']);
  });
});
