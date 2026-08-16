import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ApiError, api } from '../lib/api';
import {
  apiProvider,
  type PendingMutation,
  type QueuedStorageProvider,
  type StorageProvider,
} from '../lib/storage-provider';
import type { State, Task, Whiteboard } from '../lib/types';
import { ProjectProvider, projectReducer, useProject } from './project-context';
import type { ProjectAction } from './project-context';
import { RealtimeSocket } from '../lib/realtime-client';

const TASK: Omit<Task, 'createdAt' | 'updatedAt'> = {
  id: 't1',
  title: 'Original',
  status: 'todo',
  priority: 'medium',
  labels: [],
  blockedBy: [],
  description: '',
};

function makeState(): State {
  return {
    tasks: [{ ...TASK, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
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

function Probe() {
  const ctx = useProject();
  return (
    <div>
      <button onClick={() => ctx.dispatch(editAction())}>edit</button>
      <button onClick={() => ctx.retrySave()}>retry</button>
      <button onClick={() => void ctx.resolveConflict()}>resolve</button>
      <span data-testid="title">{ctx.state?.tasks[0]?.title ?? 'none'}</span>
      <span data-testid="save-error">{ctx.saveError ?? ''}</span>
      <span data-testid="conflict">{ctx.conflict ? 'conflict' : ''}</span>
      <span data-testid="pending">{ctx.pendingCount}</span>
      <span data-testid="offline">{ctx.isOffline ? 'offline' : 'online'}</span>
      <span data-testid="presence">{ctx.presence.length}</span>
    </div>
  );
}

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = 't1';

function renderProvider() {
  return render(
    <ProjectProvider projectId={PROJECT_ID} role="owner">
      <Probe />
    </ProjectProvider>,
  );
}

async function flush(): Promise<void> {
  await act(async () => {});
}

describe('project save pipeline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('persists the latest edits after the debounce', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const getState = vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });
    const patchEntity = vi
      .spyOn(api, 'patchEntity')
      .mockResolvedValue({ entity: { ...TASK, createdAt: '', updatedAt: '' }, version: 2 });

    renderProvider();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(screen.getByTestId('title').textContent).toBe('Edited');

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(patchEntity).toHaveBeenCalledTimes(1);
    expect(patchEntity).toHaveBeenCalledWith(
      PROJECT_ID,
      'tasks',
      TASK_ID,
      expect.objectContaining({ title: 'Edited' }),
      1,
      undefined,
    );
    expect(getState).toHaveBeenCalledTimes(1);
  });

  it('drops local edits on a 409 when the server is newer (LWW) and resolves to the server version', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const serverState = makeState();
    serverState.tasks[0]!.title = 'Server wins';
    serverState.tasks[0]!.updatedAt = '2999-01-01T00:00:00.000Z';
    vi.spyOn(api, 'getState')
      .mockResolvedValueOnce({ state: makeState(), version: 1 })
      .mockResolvedValueOnce({ state: serverState, version: 2 })
      .mockResolvedValueOnce({ state: serverState, version: 2 });
    vi.spyOn(api, 'patchEntity').mockRejectedValue(
      new ApiError(409, 'CONFLICT', 'conflicted', {
        current: { version: 2 },
      }),
    );

    renderProvider();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(screen.getByTestId('conflict').textContent).toBe('conflict');

    fireEvent.click(screen.getByRole('button', { name: 'resolve' }));
    await flush();
    await flush();

    expect(screen.getByTestId('title').textContent).toBe('Server wins');
    expect(screen.getByTestId('conflict').textContent).toBe('');
  });

  it('keeps local edits when a save fails and retry succeeds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });
    const patchEntity = vi
      .spyOn(api, 'patchEntity')
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'boom'))
      .mockResolvedValue({ entity: { ...TASK, createdAt: '', updatedAt: '' }, version: 2 });

    renderProvider();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(patchEntity).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('title').textContent).toBe('Edited');
    expect(screen.getByTestId('save-error').textContent).toContain('boom');

    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await flush();
    await flush();

    expect(patchEntity).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('title').textContent).toBe('Edited');
    expect(screen.getByTestId('save-error').textContent).toBe('');
  });

  it('flushes a pending mutation on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });
    const patchEntity = vi
      .spyOn(api, 'patchEntity')
      .mockResolvedValue({ entity: { ...TASK, createdAt: '', updatedAt: '' }, version: 2 });

    const { unmount } = renderProvider();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    unmount();

    expect(patchEntity).toHaveBeenCalledWith(
      PROJECT_ID,
      'tasks',
      TASK_ID,
      expect.objectContaining({ title: 'Edited' }),
      1,
      undefined,
    );
  });

  it('skips polling while a save is in flight', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const getState = vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });
    let resolvePatch!: (v: { entity: { id: string } & Record<string, unknown>; version: number }) => void;
    const patchEntity = vi.spyOn(api, 'patchEntity').mockImplementation(
      () =>
        new Promise<{ entity: { id: string } & Record<string, unknown>; version: number }>((resolve) => {
          resolvePatch = resolve;
        }),
    );

    renderProvider();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(patchEntity).toHaveBeenCalledTimes(1);
    expect(getState).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePatch({ entity: { ...TASK, createdAt: '', updatedAt: '' }, version: 2 });
    });
    await flush();
  });
});

describe('storage provider injection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('routes loads and saves through an injected provider', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const calls: string[] = [];
    const fake: StorageProvider = {
      loadState: async () => {
        calls.push('load');
        return { state: makeState(), version: 1 };
      },
      createEntity: async () => {
        calls.push('create');
        return { entity: { id: 'x' }, version: 2 };
      },
      updateEntity: async () => {
        calls.push('update');
        return { entity: { id: 'x' }, version: 2 };
      },
      deleteEntity: async () => {
        calls.push('delete');
        return { ok: true, version: 2 };
      },
    };
    const apiGetState = vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 99 });
    const apiPatch = vi.spyOn(api, 'patchEntity').mockResolvedValue({ entity: { id: 'x' }, version: 99 });

    render(
      <ProjectProvider projectId={PROJECT_ID} role="owner" provider={fake}>
        <Probe />
      </ProjectProvider>,
    );
    await flush();
    expect(calls).toEqual(['load']);
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(calls).toContain('update');
    expect(apiGetState).not.toHaveBeenCalled();
    expect(apiPatch).not.toHaveBeenCalled();
  });

  it('uses apiProvider by default when none is passed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const loadState = vi.spyOn(apiProvider, 'loadState').mockResolvedValue({ state: makeState(), version: 1 });

    renderProvider();
    await flush();

    expect(loadState).toHaveBeenCalledWith(PROJECT_ID);
    expect(screen.getByTestId('title').textContent).toBe('Original');
  });

  it('surfaces a 409 from a custom provider without ApiError', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const serverState = makeState();
    serverState.tasks[0]!.title = 'Server wins';
    serverState.tasks[0]!.updatedAt = '2999-01-01T00:00:00.000Z';
    let loads = 0;
    const fake: StorageProvider = {
      loadState: async () => {
        loads += 1;
        return loads === 1 ? { state: makeState(), version: 1 } : { state: serverState, version: 2 };
      },
      createEntity: async () => ({ entity: { id: 'x' }, version: 2 }),
      updateEntity: async () => {
        throw { message: 'conflicted', status: 409, details: { current: { version: 2 } } };
      },
      deleteEntity: async () => ({ ok: true, version: 2 }),
    };

    render(
      <ProjectProvider projectId={PROJECT_ID} role="owner" provider={fake}>
        <Probe />
      </ProjectProvider>,
    );
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(screen.getByTestId('conflict').textContent).toBe('conflict');

    fireEvent.click(screen.getByRole('button', { name: 'resolve' }));
    await flush();
    await flush();

    expect(screen.getByTestId('title').textContent).toBe('Server wins');
    expect(screen.getByTestId('conflict').textContent).toBe('');
  });

  it('reconciles a 409 with LWW — local edits survive when locally newer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    let loads = 0;
    let updateCalls = 0;
    let lastVersion: number | undefined;
    const fake: StorageProvider = {
      loadState: async () => {
        loads += 1;
        return { state: makeState(), version: loads > 1 ? 2 : 1 };
      },
      createEntity: async () => ({ entity: { id: 'x' }, version: 3 }),
      updateEntity: async (_projectId, _entity, _entityId, _payload, version) => {
        updateCalls += 1;
        if (updateCalls === 1) {
          throw { message: 'conflicted', status: 409, details: { current: { version: 2 } } };
        }
        lastVersion = version;
        return { entity: { id: 'x' }, version: 3 };
      },
      deleteEntity: async () => ({ ok: true, version: 3 }),
    };

    render(
      <ProjectProvider projectId={PROJECT_ID} role="owner" provider={fake}>
        <Probe />
      </ProjectProvider>,
    );
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(screen.getByTestId('title').textContent).toBe('Edited');
    expect(screen.getByTestId('conflict').textContent).toBe('');
    expect(screen.getByTestId('save-error').textContent).toBe('');
    expect(updateCalls).toBe(2);
    expect(loads).toBe(2);
    expect(lastVersion).toBe(2);
  });
});

describe('queued storage provider (offline journal)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function makeQueued(overrides: Partial<QueuedStorageProvider> = {}) {
    const queue = new Map<string, PendingMutation>();
    const fake: QueuedStorageProvider = {
      loadState: async () => ({ state: makeState(), version: 1 }),
      createEntity: async () => ({ entity: { id: 'x' }, version: 2 }),
      updateEntity: async () => ({ entity: { id: 'x' }, version: 2 }),
      deleteEntity: async () => ({ ok: true, version: 2 }),
      listPendingMutations: async () => [...queue.values()],
      enqueuePendingMutation: async (_projectId, mutation) => {
        queue.set(mutation.key, mutation);
      },
      removePendingMutation: async (_projectId, mutationKey) => {
        queue.delete(mutationKey);
      },
      clearPendingMutations: async () => {
        queue.clear();
      },
      ...overrides,
    };
    return { fake, queue };
  }

  function renderQueued(provider: QueuedStorageProvider) {
    return render(
      <ProjectProvider projectId={PROJECT_ID} role="owner" provider={provider}>
        <Probe />
      </ProjectProvider>,
    );
  }

  it('hydrates a persisted queue on mount and replays it with the fresh version', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const { fake, queue } = makeQueued();
    const replayed = makeState();
    replayed.tasks[0]!.title = 'Replayed';
    let loads = 0;
    fake.loadState = async () => {
      loads += 1;
      return loads === 1 ? { state: makeState(), version: 1 } : { state: replayed, version: 2 };
    };
    const update = vi.spyOn(fake, 'updateEntity').mockResolvedValue({ entity: { id: 'x' }, version: 2 });
    const remove = vi.spyOn(fake, 'removePendingMutation');
    queue.set('tasks:t1', {
      key: 'tasks:t1',
      entity: 'tasks',
      op: 'update',
      id: 't1',
      payload: { title: 'Replayed' },
    });

    renderQueued(fake);
    await flush();

    expect(update).toHaveBeenCalledWith(
      PROJECT_ID,
      'tasks',
      't1',
      expect.objectContaining({ title: 'Replayed' }),
      1,
      undefined,
    );
    expect(remove).toHaveBeenCalledWith(PROJECT_ID, 'tasks:t1');
    expect(screen.getByTestId('title').textContent).toBe('Replayed');
    expect(queue.size).toBe(0);
  });

  it('journals every dispatched mutation through the provider', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const { fake } = makeQueued();
    const enqueue = vi.spyOn(fake, 'enqueuePendingMutation');

    renderQueued(fake);
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await flush();

    expect(enqueue).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ key: 'tasks:t1', op: 'update', payload: { title: 'Edited' } }),
    );
  });

  it('clears the journal on a 409 conflict', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const { fake, queue } = makeQueued();
    fake.updateEntity = async () => {
      throw new ApiError(409, 'CONFLICT', 'conflicted', { current: { version: 2 } });
    };
    const clear = vi.spyOn(fake, 'clearPendingMutations');
    queue.set('tasks:t1', {
      key: 'tasks:t1',
      entity: 'tasks',
      op: 'update',
      id: 't1',
      payload: { title: 'Edited' },
    });

    renderQueued(fake);
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(screen.getByTestId('conflict').textContent).toBe('conflict');
    expect(clear).toHaveBeenCalledWith(PROJECT_ID);
    expect(queue.size).toBe(0);
  });
});

describe('sync status surface', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reports the pending mutation count while the queue is draining', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });
    const patchEntity = vi
      .spyOn(api, 'patchEntity')
      .mockResolvedValue({ entity: { ...TASK, createdAt: '', updatedAt: '' }, version: 2 });

    renderProvider();
    await flush();
    expect(screen.getByTestId('pending').textContent).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(screen.getByTestId('pending').textContent).toBe('1');
    expect(screen.getByTestId('offline').textContent).toBe('online');

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(screen.getByTestId('pending').textContent).toBe('0');
    expect(patchEntity).toHaveBeenCalledTimes(1);
  });

  it('flags offline on a network error and clears it after retry succeeds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });
    vi.spyOn(api, 'patchEntity')
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?'))
      .mockResolvedValue({ entity: { ...TASK, createdAt: '', updatedAt: '' }, version: 2 });

    renderProvider();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(screen.getByTestId('offline').textContent).toBe('offline');
    expect(screen.getByTestId('pending').textContent).toBe('1');
    expect(screen.getByTestId('save-error').textContent).toContain('Cannot reach the server');

    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await flush();

    expect(screen.getByTestId('offline').textContent).toBe('online');
    expect(screen.getByTestId('pending').textContent).toBe('0');
    expect(screen.getByTestId('save-error').textContent).toBe('');
  });

  it('tracks browser offline/online events', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });

    renderProvider();
    await flush();
    expect(screen.getByTestId('offline').textContent).toBe('online');

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByTestId('offline').textContent).toBe('offline');

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.getByTestId('offline').textContent).toBe('online');
  });
});

describe('milestone unlink on removal', () => {
  it('clears milestoneId on tasks linked to the removed milestone', () => {
    const milestoneId = 'm1';
    const state = makeState();
    state.milestones = [
      {
        id: milestoneId,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        name: 'M7',
        version: '0.2.0',
        targetDate: '2026-08-11',
        status: 'inProgress',
        changelog: '',
      },
    ];
    state.tasks = [
      { ...TASK, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', milestoneId },
      { ...TASK, id: 't2', title: 'Other', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ];

    const next = projectReducer(state, { type: 'milestone/remove', id: milestoneId });

    expect(next.milestones).toHaveLength(0);
    expect(next.tasks.find((t) => t.id === 't1')?.milestoneId).toBeNull();
    expect(next.tasks.find((t) => t.id === 't2')?.milestoneId).toBeUndefined();
  });
});

describe('whiteboard reducer', () => {
  it('adds, updates and removes whiteboards without side effects on other entities', () => {
    const state = makeState();
    const board: Whiteboard = {
      id: 'wb1',
      name: 'Sketch',
      description: '',
      elements: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const added = projectReducer(state, { type: 'whiteboard/add', whiteboard: board });
    expect(added.whiteboards).toHaveLength(1);
    expect(added.whiteboards[0]).toEqual(board);

    const updated = projectReducer(added, {
      type: 'whiteboard/update',
      id: 'wb1',
      patch: { name: 'Sketch v2' },
    });
    expect(updated.whiteboards[0]!.name).toBe('Sketch v2');
    expect(updated.tasks).toEqual(added.tasks);

    const removed = projectReducer(updated, { type: 'whiteboard/remove', id: 'wb1' });
    expect(removed.whiteboards).toHaveLength(0);
    expect(removed.tasks).toEqual(updated.tasks);
  });

  it('strips ref elements pointing at a task when the task is removed', () => {
    const state = makeState();
    const board: Whiteboard = {
      id: 'wb1',
      name: 'Sketch',
      description: '',
      elements: [
        {
          id: 'r1',
          kind: 'ref',
          entity: 'tasks',
          entityId: 't1',
          x: 10,
          y: 20,
        },
        { id: 'r2', kind: 'ref', entity: 'issues', entityId: 'i1', x: 30, y: 40 },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    state.whiteboards = [board];

    const next = projectReducer(state, { type: 'task/remove', id: 't1' });

    expect(next.whiteboards[0]!.elements.map((el) => el.id)).toEqual(['r2']);
  });

  it('strips ref elements pointing at an issue when the issue is removed', () => {
    const state = makeState();
    const board: Whiteboard = {
      id: 'wb1',
      name: 'Sketch',
      description: '',
      elements: [
        { id: 'r1', kind: 'ref', entity: 'tasks', entityId: 't1', x: 10, y: 20 },
        { id: 'r2', kind: 'ref', entity: 'issues', entityId: 'i1', x: 30, y: 40 },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    state.whiteboards = [board];

    const next = projectReducer(state, { type: 'issue/remove', id: 'i1' });

    expect(next.whiteboards[0]!.elements.map((el) => el.id)).toEqual(['r1']);
  });
});

class FakeWs {
  static instances: FakeWs[] = [];
  readyState = 0;
  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(_url: string) {
    FakeWs.instances.push(this);
  }

  addEventListener(type: string, cb: (event: MessageEvent) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(cb);
    this.listeners.set(type, set);
  }

  send(_data: string): void {}

  close(): void {
    this.readyState = 3;
    this.fire('close');
  }

  open(): void {
    this.readyState = 1;
    this.fire('open');
  }

  emit(data: string): void {
    this.fire('message', { data } as unknown as MessageEvent);
  }

  private fire(type: string, event?: MessageEvent): void {
    for (const cb of this.listeners.get(type) ?? []) cb((event ?? {}) as MessageEvent);
  }
}

describe('realtime state:diff integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    FakeWs.instances = [];
  });

  function renderRealtime() {
    return render(
      <ProjectProvider
        projectId={PROJECT_ID}
        role="owner"
        createRealtime={(handlers) => new RealtimeSocket({ wsUrl: 'ws://x', projectId: PROJECT_ID, WebSocketCtor: FakeWs, ...handlers })}
      >
        <Probe />
      </ProjectProvider>,
    );
  }

  it('applies a server diff for an entity the local client did not edit', async () => {
    vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });

    renderRealtime();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    const ws = FakeWs.instances[0]!;
    void ws.open();
    const server = makeState();
    server.tasks[0]!.title = 'Realtime';
    act(() => {
      ws.emit(JSON.stringify({ type: 'state:diff', projectId: PROJECT_ID, version: 2, ops: [{ entity: 'tasks', id: TASK_ID, op: 'updated', after: server.tasks[0] }] }));
    });

    expect(screen.getByTestId('title').textContent).toBe('Realtime');
  });

  it('skips diffs for entities with pending local mutations', async () => {
    vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });
    vi.spyOn(api, 'patchEntity').mockResolvedValue({ entity: { ...TASK, createdAt: '', updatedAt: '' }, version: 2 });

    renderRealtime();
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(screen.getByTestId('title').textContent).toBe('Edited');

    const ws = FakeWs.instances[0]!;
    void ws.open();
    const server = makeState();
    server.tasks[0]!.title = 'Server echo';
    act(() => {
      ws.emit(JSON.stringify({ type: 'state:diff', projectId: PROJECT_ID, version: 2, ops: [{ entity: 'tasks', id: TASK_ID, op: 'updated', after: server.tasks[0] }] }));
    });

    expect(screen.getByTestId('title').textContent).toBe('Edited');
  });

  it('updates presence state from server frames', async () => {
    vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });

    renderRealtime();
    await flush();

    const ws = FakeWs.instances[0]!;
    void ws.open();
    act(() => {
      ws.emit(
        JSON.stringify({
          type: 'presence',
          projectId: PROJECT_ID,
          users: [
            { userId: 'u1', name: 'One' },
            { userId: 'u2', name: '' },
          ],
        }),
      );
    });

    expect(screen.getByTestId('presence').textContent).toBe('2');
  });

  it('ignores presence frames for another project', async () => {
    vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });

    renderRealtime();
    await flush();

    const ws = FakeWs.instances[0]!;
    void ws.open();
    act(() => {
      ws.emit(JSON.stringify({ type: 'presence', projectId: 'other-project', users: [{ userId: 'u1', name: 'One' }] }));
    });

    expect(screen.getByTestId('presence').textContent).toBe('0');
  });

  it('skips diffs whose version is not newer than the loaded version', async () => {
    const getState = vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });

    renderRealtime();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    const ws = FakeWs.instances[0]!;
    void ws.open();
    const server = makeState();
    server.tasks[0]!.title = 'Stale';
    act(() => {
      ws.emit(
        JSON.stringify({ type: 'state:diff', projectId: PROJECT_ID, version: 1, ops: [{ entity: 'tasks', id: TASK_ID, op: 'updated', after: server.tasks[0] }] }),
      );
    });

    expect(screen.getByTestId('title').textContent).toBe('Original');
    expect(getState).toHaveBeenCalledTimes(1);
  });

  it('refetches the whole state on a coarse sync frame', async () => {
    const synced = makeState();
    synced.tasks[0]!.title = 'Synced';
    const getState = vi
      .spyOn(api, 'getState')
      .mockResolvedValueOnce({ state: makeState(), version: 1 })
      .mockResolvedValueOnce({ state: synced, version: 2 });

    renderRealtime();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    const ws = FakeWs.instances[0]!;
    void ws.open();
    act(() => {
      ws.emit(JSON.stringify({ type: 'state:sync', projectId: PROJECT_ID, version: 2 }));
    });
    await flush();

    expect(screen.getByTestId('title').textContent).toBe('Synced');
    expect(getState).toHaveBeenCalledTimes(2);
  });

  it('resyncs from the server after a reconnect (joined frame)', async () => {
    const rejoined = makeState();
    rejoined.tasks[0]!.title = 'Rejoined';
    const getState = vi
      .spyOn(api, 'getState')
      .mockResolvedValueOnce({ state: makeState(), version: 1 })
      .mockResolvedValueOnce({ state: rejoined, version: 2 });

    renderRealtime();
    await flush();

    const ws = FakeWs.instances[0]!;
    void ws.open();
    act(() => {
      ws.emit(JSON.stringify({ type: 'joined', projectId: PROJECT_ID, role: 'owner', teamId: 't' }));
    });
    await flush();

    expect(screen.getByTestId('title').textContent).toBe('Rejoined');
    expect(getState).toHaveBeenCalledTimes(2);
  });
});
