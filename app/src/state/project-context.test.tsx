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
      <span data-testid="title">{ctx.state?.tasks[0]?.title ?? 'none'}</span>
      <span data-testid="save-error">{ctx.saveError ?? ''}</span>
    </div>
  );
}

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

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
    const getState = vi.spyOn(api, 'getState').mockResolvedValue(makeState());
    const putState = vi.spyOn(api, 'putState').mockResolvedValue({ ok: true });

    renderProvider();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    expect(screen.getByTestId('title').textContent).toBe('Edited');

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(putState).toHaveBeenCalledTimes(1);
    expect(putState).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ tasks: [expect.objectContaining({ title: 'Edited' })] }),
    );
    expect(getState).toHaveBeenCalledTimes(1);
  });

  it('keeps local edits when a save fails and retry succeeds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vi.spyOn(api, 'getState').mockResolvedValue(makeState());
    const putState = vi
      .spyOn(api, 'putState')
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'boom'))
      .mockResolvedValue({ ok: true });

    renderProvider();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await flush();

    expect(putState).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('title').textContent).toBe('Edited');
    expect(screen.getByTestId('save-error').textContent).toContain('boom');

    fireEvent.click(screen.getByRole('button', { name: 'retry' }));
    await flush();
    await flush();

    expect(putState).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('title').textContent).toBe('Edited');
    expect(screen.getByTestId('save-error').textContent).toBe('');
  });

  it('flushes a pending save on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    vi.spyOn(api, 'getState').mockResolvedValue(makeState());
    const putState = vi.spyOn(api, 'putState').mockResolvedValue({ ok: true });

    const { unmount } = renderProvider();
    await flush();
    expect(screen.getByTestId('title').textContent).toBe('Original');

    fireEvent.click(screen.getByRole('button', { name: 'edit' }));
    unmount();

    expect(putState).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({ tasks: [expect.objectContaining({ title: 'Edited' })] }),
    );
  });

  it('skips polling while a save is in flight', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const getState = vi.spyOn(api, 'getState').mockResolvedValue(makeState());
    let resolvePut!: (v: { ok: true }) => void;
    const putState = vi.spyOn(api, 'putState').mockImplementation(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolvePut = resolve;
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

    expect(putState).toHaveBeenCalledTimes(1);
    expect(getState).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePut({ ok: true });
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
