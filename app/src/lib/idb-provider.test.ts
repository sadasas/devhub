import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { isNetworkError, offlineProvider } from './idb-provider';
import { getCachedProject, getQueuedMutations, openDevHubDb, resetDevHubDb } from './idb';
import type { StorageProvider } from './storage-provider';
import type { State } from './types';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function makeState(): State {
  return {
    tasks: [
      {
        id: 't1',
        title: 'Original',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
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

const network = () => new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?');
const unauthorized = () => new ApiError(401, 'UNAUTHORIZED', 'nope');

function makeFake(overrides: Partial<StorageProvider> = {}): StorageProvider & {
  state: State;
  offline: boolean;
} {
  const fake = {
    state: makeState(),
    offline: false,
    async loadState(_projectId: string) {
      if (fake.offline) throw network();
      return { state: fake.state, version: 7 };
    },
    createEntity: async () => {
      if (fake.offline) throw network();
      return { entity: { id: 't2' }, version: 8 };
    },
    updateEntity: async () => {
      if (fake.offline) throw network();
      return { entity: { id: 't1' }, version: 8 };
    },
    deleteEntity: async () => {
      if (fake.offline) throw network();
      return { ok: true, version: 8 };
    },
    ...overrides,
  } as StorageProvider & {
    state: State;
    offline: boolean;
  };
  return fake;
}

describe('offlineProvider', () => {
  beforeEach(async () => {
    await openDevHubDb();
  });

  afterEach(async () => {
    await resetDevHubDb();
  });

  it('caches a snapshot on successful load and serves it on network failure', async () => {
    const fake = makeFake();
    const provider = offlineProvider(fake);

    await provider.loadState(PROJECT_ID);
    expect(await getCachedProject(PROJECT_ID)).toMatchObject({ version: 7 });

    fake.offline = true;
    const fallback = await provider.loadState(PROJECT_ID);
    expect(fallback.state).toEqual(fake.state);
    expect(fallback.version).toBe(7);
  });

  it('propagates non-network load errors without cache fallback', async () => {
    const fake = makeFake({
      loadState: async () => {
        throw unauthorized();
      },
    });
    const provider = offlineProvider(fake);
    await expect(provider.loadState(PROJECT_ID)).rejects.toBeInstanceOf(ApiError);
    expect(await getCachedProject(PROJECT_ID)).toBeUndefined();
  });

  it('rethrows the original error when there is no cache', async () => {
    const fake = makeFake();
    fake.offline = true;
    const provider = offlineProvider(fake);
    await expect(provider.loadState(PROJECT_ID)).rejects.toBeInstanceOf(ApiError);
  });

  it('journals writes and removes entries only on success', async () => {
    const fake = makeFake();
    const innerSpy = offlineProvider({
      ...fake,
      async updateEntity(_projectId, _entity, entityId, _payload, _version) {
        if (fake.offline) throw network();
        return { entity: { id: entityId }, version: 9 };
      },
    });

    await innerSpy.updateEntity(PROJECT_ID, 'tasks', 't1', { title: 'Edited' }, 7);
    let queued = await getQueuedMutations(PROJECT_ID);
    expect(queued).toHaveLength(0);

    fake.offline = true;
    await expect(innerSpy.updateEntity(PROJECT_ID, 'tasks', 't1', { title: 'Edited' }, 7)).rejects.toBeInstanceOf(
      ApiError,
    );
    queued = await getQueuedMutations(PROJECT_ID);
    expect(queued).toHaveLength(1);
    expect(queued[0]!.mutation).toMatchObject({ key: 'tasks:t1', op: 'update', entity: 'tasks' });
  });

  it('supports the queued-provider surface (list/enqueue/remove/clear)', async () => {
    const provider = offlineProvider(makeFake());
    expect(isNetworkError(network())).toBe(true);
    expect(isNetworkError(unauthorized())).toBe(false);

    await provider.enqueuePendingMutation(PROJECT_ID, {
      key: 'tasks:t1',
      entity: 'tasks',
      op: 'update',
      id: 't1',
      payload: { title: 'Edited' },
    });
    await provider.enqueuePendingMutation(PROJECT_ID, {
      key: 'issues:i1',
      entity: 'issues',
      op: 'create',
      id: 'i1',
      payload: { id: 'i1' },
    });

    expect(await provider.listPendingMutations(PROJECT_ID)).toHaveLength(2);
    await provider.removePendingMutation(PROJECT_ID, 'tasks:t1');
    expect((await provider.listPendingMutations(PROJECT_ID)).map((m) => m.key)).toEqual(['issues:i1']);

    await provider.clearPendingMutations(PROJECT_ID);
    expect(await provider.listPendingMutations(PROJECT_ID)).toHaveLength(0);
  });
});