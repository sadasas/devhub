import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearQueuedMutations,
  deleteQueuedMutation,
  getCachedProject,
  getMeta,
  getQueuedMutations,
  openDevHubDb,
  putCachedProject,
  putMeta,
  putQueuedMutation,
  resetDevHubDb,
} from './idb';
import type { PendingMutation } from './storage-provider';
import type { State } from './types';

const PROJECT_A = '11111111-1111-4111-8111-111111111111';
const PROJECT_B = '22222222-2222-4222-8222-222222222222';

function makeState(): State {
  return {
    tasks: [],
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

const MUTATION: PendingMutation = {
  key: 'tasks:t1',
  entity: 'tasks',
  op: 'update',
  id: 't1',
  payload: { title: 'Edited' },
};

describe('idb wrapper', () => {
  beforeEach(async () => {
    await openDevHubDb();
  });

  afterEach(async () => {
    await resetDevHubDb();
  });

  it('round-trips a cached project snapshot', async () => {
    const state = makeState();
    await putCachedProject(PROJECT_A, state, 7);
    const cached = await getCachedProject(PROJECT_A);
    expect(cached?.projectId).toBe(PROJECT_A);
    expect(cached?.version).toBe(7);
    expect(cached?.state).toEqual(state);
  });

  it('returns undefined for a project with no cache', async () => {
    await expect(getCachedProject(PROJECT_A)).resolves.toBeUndefined();
  });

  it('overwrites the snapshot for the same project', async () => {
    await putCachedProject(PROJECT_A, makeState(), 1);
    await putCachedProject(PROJECT_A, makeState(), 2);
    expect((await getCachedProject(PROJECT_A))?.version).toBe(2);
  });

  it('enqueues, lists, removes and clears mutations per project', async () => {
    await putQueuedMutation(PROJECT_A, MUTATION);
    await putQueuedMutation(PROJECT_A, { ...MUTATION, key: 'issues:i1', entity: 'issues', id: 'i1' });
    await putQueuedMutation(PROJECT_B, MUTATION);

    const a = await getQueuedMutations(PROJECT_A);
    expect(a).toHaveLength(2);
    expect(a.map((r) => r.mutation.key).sort()).toEqual(['issues:i1', 'tasks:t1']);
    expect(await getQueuedMutations(PROJECT_B)).toHaveLength(1);

    await deleteQueuedMutation(PROJECT_A, 'tasks:t1');
    expect((await getQueuedMutations(PROJECT_A)).map((r) => r.mutation.key)).toEqual(['issues:i1']);
    expect(await getQueuedMutations(PROJECT_B)).toHaveLength(1);

    await clearQueuedMutations(PROJECT_A);
    expect(await getQueuedMutations(PROJECT_A)).toHaveLength(0);
    expect(await getQueuedMutations(PROJECT_B)).toHaveLength(1);
  });

  it('coalesces mutations with the same entity+id key', async () => {
    await putQueuedMutation(PROJECT_A, MUTATION);
    await putQueuedMutation(PROJECT_A, { ...MUTATION, payload: { title: 'Edited again' } });
    const list = await getQueuedMutations(PROJECT_A);
    expect(list).toHaveLength(1);
    expect(list[0]!.mutation.payload).toEqual({ title: 'Edited again' });
  });

  it('round-trips meta rows and returns undefined for missing keys', async () => {
    await putMeta('user', { id: 'u1', email: 'a@b.c' });
    const value = await getMeta<{ id: string; email: string }>('user');
    expect(value).toEqual({ id: 'u1', email: 'a@b.c' });
    expect(await getMeta('missing')).toBeUndefined();
  });

  it('overwrites a meta row for the same key', async () => {
    await putMeta('projects', [{ id: 'p1' }]);
    await putMeta('projects', [{ id: 'p2' }]);
    expect(await getMeta<{ id: string }[]>('projects')).toEqual([{ id: 'p2' }]);
  });
});
