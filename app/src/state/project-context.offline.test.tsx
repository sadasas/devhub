import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '../lib/api';
import { offlineProvider } from '../lib/idb-provider';
import { getCachedProject, getQueuedMutations, openDevHubDb, putQueuedMutation, resetDevHubDb } from '../lib/idb';
import type { StorageProvider } from '../lib/storage-provider';
import type { State } from '../lib/types';
import { ProjectProvider, useProject } from './project-context';
import type { ProjectAction } from './project-context';

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

function editAction(): ProjectAction {
  return { type: 'task/update', id: 't1', patch: { title: 'Edited' } };
}

const network = () => new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?');

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

function Probe() {
  const ctx = useProject();
  return (
    <div>
      <button onClick={() => ctx.dispatch(editAction())}>edit</button>
      <button onClick={() => ctx.retrySave()}>retry</button>
      <span data-testid="title">{ctx.state?.tasks[0]?.title ?? 'none'}</span>
      <span data-testid="conflict">{ctx.conflict ? 'conflict' : ''}</span>
      <span data-testid="pending">{ctx.pendingCount}</span>
      <span data-testid="offline">{ctx.isOffline ? 'offline' : 'online'}</span>
    </div>
  );
}

function renderOffline(provider: StorageProvider) {
  return render(
    <ProjectProvider projectId={PROJECT_ID} role="owner" provider={provider}>
      <Probe />
    </ProjectProvider>,
  );
}

async function flush(): Promise<void> {
  await act(async () => {});
}

async function waitDebounce(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
  });
}

describe('offline integration (ProjectProvider + offlineProvider + IndexedDB)', () => {
  beforeEach(async () => {
    await openDevHubDb();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await resetDevHubDb();
  });

  it('serves the cached snapshot and persisted queue after an offline reload', async () => {
    const fake = makeFake();
    const provider = offlineProvider(fake);

    const { unmount } = renderOffline(provider);
    await flush();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');
    expect(await getCachedProject(PROJECT_ID)).toMatchObject({ version: 7 });

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(screen.getByTestId('pending').textContent).toBe('1');

    fake.offline = true;
    await waitDebounce();
    await waitFor(() => expect(screen.getByTestId('offline').textContent).toBe('offline'));
    expect(await getQueuedMutations(PROJECT_ID)).toHaveLength(1);

    unmount();
    await flush();

    renderOffline(provider);
    await waitFor(() => expect(screen.getByTestId('title').textContent).toBe('Original'));
    await waitFor(() => expect(screen.getByTestId('pending').textContent).toBe('1'));
    await waitFor(() => expect(screen.getByTestId('offline').textContent).toBe('offline'));
    expect(await getQueuedMutations(PROJECT_ID)).toHaveLength(1);
  });

  it('replays the journaled mutation after the network recovers', async () => {
    const fake = makeFake();
    const provider = offlineProvider(fake);
    const update = vi.spyOn(fake, 'updateEntity');

    const { unmount } = renderOffline(provider);
    await flush();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fake.offline = true;
    await waitDebounce();
    expect(await getQueuedMutations(PROJECT_ID)).toHaveLength(1);
    unmount();

    renderOffline(provider);
    await waitFor(async () => expect(await getQueuedMutations(PROJECT_ID)).toHaveLength(1));

    fake.offline = false;
    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() => expect(screen.getByTestId('pending').textContent).toBe('0'));
    await waitFor(() => expect(screen.getByTestId('offline').textContent).toBe('online'));

    expect(update).toHaveBeenCalledWith(
      PROJECT_ID,
      'tasks',
      't1',
      expect.objectContaining({ title: 'Edited' }),
      expect.any(Number),
      undefined,
    );
    expect(await getQueuedMutations(PROJECT_ID)).toHaveLength(0);
  });

  it('drops a stale journaled mutation when the server is newer (LWW)', async () => {
    const fake = makeFake();
    const serverState = makeState();
    serverState.tasks[0]!.title = 'Server wins';
    serverState.tasks[0]!.updatedAt = '2999-01-01T00:00:00.000Z';
    fake.state = serverState;
    fake.updateEntity = async () => {
      throw new ApiError(409, 'CONFLICT', 'conflicted', { current: { version: 2 } });
    };
    await putQueuedMutation(PROJECT_ID, {
      key: 'tasks:t1',
      entity: 'tasks',
      op: 'update',
      id: 't1',
      payload: { title: 'Edited' },
    });

    const provider = offlineProvider(fake);
    renderOffline(provider);
    await waitFor(() => expect(screen.getByTestId('title').textContent).toBe('Server wins'));
    await waitFor(() => expect(screen.getByTestId('conflict').textContent).toBe('conflict'));
    expect(await getQueuedMutations(PROJECT_ID)).toHaveLength(0);
  });

  it('replays a locally-newer mutation after a 409 with the fresh version', async () => {
    const older = makeState();
    older.tasks[0]!.updatedAt = '2025-01-01T00:00:00.000Z';
    const fake = makeFake();
    let loads = 0;
    let updateCalls = 0;
    let lastVersion: number | undefined;
    fake.loadState = async () => {
      loads += 1;
      return { state: loads === 1 ? makeState() : older, version: loads === 1 ? 1 : 2 };
    };
    fake.updateEntity = async (_projectId, _entity, _entityId, _payload, version) => {
      updateCalls += 1;
      if (updateCalls === 1) {
        throw new ApiError(409, 'CONFLICT', 'conflicted', { current: { version: 2 } });
      }
      lastVersion = version;
      return { entity: { id: 't1' }, version: 3 };
    };
    await putQueuedMutation(PROJECT_ID, {
      key: 'tasks:t1',
      entity: 'tasks',
      op: 'update',
      id: 't1',
      payload: { title: 'Edited' },
    });

    const provider = offlineProvider(fake);
    renderOffline(provider);
    await waitFor(() => expect(updateCalls).toBe(2));

    expect(lastVersion).toBe(2);
    expect(screen.getByTestId('conflict').textContent).toBe('');
    expect(screen.getByTestId('pending').textContent).toBe('0');
    expect(screen.getByTestId('title').textContent).toBe('Original');
    expect(await getQueuedMutations(PROJECT_ID)).toHaveLength(0);
  });

  it('coalesces repeated edits to the same entity into one journal row', async () => {
    const fake = makeFake();
    const provider = offlineProvider(fake);

    const { unmount } = renderOffline(provider);
    await flush();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    fake.offline = true;
    await waitDebounce();

    const rows = await getQueuedMutations(PROJECT_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.mutation).toMatchObject({ key: 'tasks:t1', op: 'update', payload: { title: 'Edited' } });

    unmount();
    await flush();

    renderOffline(provider);
    await waitFor(async () => expect(await getQueuedMutations(PROJECT_ID)).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId('pending').textContent).toBe('1'));
  });
});
