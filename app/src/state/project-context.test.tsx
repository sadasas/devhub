import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ApiError, api } from '../lib/api';
import type { State, Task } from '../lib/types';
import { ProjectProvider, projectReducer, useProject } from './project-context';
import type { ProjectAction } from './project-context';

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
    );
    expect(getState).toHaveBeenCalledTimes(1);
  });

  it('surfaces a 409 conflict and resolves to the server version', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const serverState = makeState();
    serverState.tasks[0]!.title = 'Server wins';
    vi.spyOn(api, 'getState')
      .mockResolvedValueOnce({ state: makeState(), version: 1 })
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
    );
  });

  it('skips polling while a save is in flight', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const getState = vi.spyOn(api, 'getState').mockResolvedValue({ state: makeState(), version: 1 });
    let resolvePatch!: (v: { entity: Task; version: number }) => void;
    const patchEntity = vi.spyOn(api, 'patchEntity').mockImplementation(
      () =>
        new Promise<{ entity: Task; version: number }>((resolve) => {
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
