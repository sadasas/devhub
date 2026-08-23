import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTabUnread } from './useTabUnread';

const subscribeMock = vi.hoisted(() => vi.fn());
const fetchUnreadMock = vi.hoisted(() => vi.fn());
const setWatermarkMock = vi.hoisted(() => vi.fn());

vi.mock('../state/project-context', () => ({
  useProject: () => ({ subscribeActivity: subscribeMock }),
}));

vi.mock('../lib/api', () => ({
  api: {
    fetchActivityUnread: fetchUnreadMock,
    setTabReadWatermark: setWatermarkMock,
  },
}));

function summary(over: Record<string, unknown> = {}) {
  return {
    counts: {},
    ids: {} as Record<string, string[]>,
    deleted: [] as Array<Record<string, unknown>>,
    watermarks: {} as Record<string, string>,
    ...over,
  };
}

function activity(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    projectId: 'p1',
    entity: 'tasks',
    entityId: 't1',
    action: 'updated' as const,
    authorId: 'u1',
    authorName: 'Ana',
    summary: 'Build login',
    changes: {} as Record<string, { from: unknown; to: unknown }>,
    createdAt: '2099-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('useTabUnread (server-side)', () => {
  beforeEach(() => {
    localStorage.clear();
    subscribeMock.mockReset();
    subscribeMock.mockReturnValue(() => {});
    fetchUnreadMock.mockReset();
    fetchUnreadMock.mockResolvedValue(summary());
    setWatermarkMock.mockReset();
    setWatermarkMock.mockResolvedValue({ ok: true });
  });

  it('adopts server counts and strips the active tab', async () => {
    fetchUnreadMock.mockResolvedValue(
      summary({
        counts: { board: 2, issues: 1, tests: 3 },
        ids: { board: ['t1', 't2'], issues: ['i9'] },
        watermarks: { board: '2026-08-01T00:00:00.000Z' },
      }),
    );

    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'board'));
    await waitFor(() => expect(result.current.unread).toEqual({ issues: 1, tests: 3 }));
    expect(result.current.unreadIds.board?.has('t1')).toBe(true);
    // Watermark server ada → localStorage lama dibersihkan tanpa seeding.
    expect(setWatermarkMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('devhub:unread:p1:u1')).toBeNull();
  });

  it('seeds legacy localStorage watermarks once when the server has none', async () => {
    fetchUnreadMock.mockResolvedValue(summary());
    localStorage.setItem(
      'devhub:unread:p1:u1',
      JSON.stringify({ board: '2026-08-01T00:00:00.000Z' }),
    );
    localStorage.setItem('devhub:deleted-dismiss:p1', '2026-08-02T00:00:00.000Z');

    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'issues'));
    await waitFor(() => expect(result.current.dismissedUntil).toBe('2026-08-02T00:00:00.000Z'));
    await waitFor(() =>
      expect(setWatermarkMock).toHaveBeenCalledWith('p1', 'board'),
    );
    expect(setWatermarkMock).toHaveBeenCalledWith('p1', '__deleted_dismiss__');
    expect(localStorage.getItem('devhub:unread:p1:u1')).toBeNull();
    expect(localStorage.getItem('devhub:deleted-dismiss:p1')).toBeNull();
  });

  it('marks the left tab read via debounced PUT and clears its badge locally', async () => {
    vi.useFakeTimers();
    try {
      fetchUnreadMock.mockResolvedValue(
        summary({ counts: { board: 4 }, ids: { board: ['t1'] } }),
      );
      const { result, rerender } = renderHook(({ tab }) => useTabUnread('p1', 'u1', tab), {
        initialProps: { tab: 'board' },
      });
      await act(async () => {});
      expect(result.current.unread.board).toBeUndefined(); // tab aktif selalu kosong

      rerender({ tab: 'issues' });
      await act(async () => {});
      expect(setWatermarkMock).not.toHaveBeenCalled(); // belum melewati debounce

      await vi.advanceTimersByTimeAsync(600);
      expect(setWatermarkMock).toHaveBeenCalledWith('p1', 'board');
    } finally {
      vi.useRealTimers();
    }
  });

  it('increments live activity on other tabs and ignores the active tab', async () => {
    let cb: (msg: { entry: ReturnType<typeof activity> }) => void = () => {};
    subscribeMock.mockImplementation((fn: typeof cb) => {
      cb = fn;
      return () => {};
    });
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'issues'));
    await act(async () => {});

    act(() => cb({ entry: activity({ entity: 'tasks' }) }));
    expect(result.current.unread.board).toBe(1);

    act(() => cb({ entry: activity({ entity: 'issues' }) }));
    expect(result.current.unread.issues ?? 0).toBe(0);
  });

  it('collects deleted entries from the server and live events', async () => {
    fetchUnreadMock.mockResolvedValue(
      summary({
        deleted: [
          {
            id: 'a1',
            entity: 'tasks',
            entityId: 't1',
            authorName: 'Ana',
            summary: 'Old task',
            createdAt: '2099-01-01T00:00:00.000Z',
          },
        ],
      }),
    );
    let cb: (msg: { entry: ReturnType<typeof activity> }) => void = () => {};
    subscribeMock.mockImplementation((fn: typeof cb) => {
      cb = fn;
      return () => {};
    });
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'issues'));
    await waitFor(() => expect(result.current.deleted.length).toBe(1));
    expect(result.current.deleted[0]!.summary).toBe('Old task');

    act(() => cb({ entry: activity({ id: 'a9', action: 'deleted', summary: 'Live task' }) }));
    expect(result.current.deleted.map((d) => d.summary)).toEqual(['Old task', 'Live task']);
  });

  it('dismisses the deleted banner on the server', async () => {
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'board'));
    await act(async () => {});
    act(() => result.current.dismissDeleted());
    expect(result.current.dismissedUntil).not.toBeNull();
    expect(setWatermarkMock).toHaveBeenCalledWith('p1', '__deleted_dismiss__');
  });

  it('adds live entity ids for other tabs and clears them when the tab is visited', async () => {
    let cb: (msg: { entry: ReturnType<typeof activity> }) => void = () => {};
    subscribeMock.mockImplementation((fn: typeof cb) => {
      cb = fn;
      return () => {};
    });
    const { result, rerender } = renderHook(({ tab }) => useTabUnread('p1', 'u1', tab), {
      initialProps: { tab: 'issues' },
    });
    await act(async () => {});
    act(() => cb({ entry: activity({ entity: 'tasks', entityId: 't1' }) }));
    expect(result.current.unreadIds.board?.has('t1')).toBe(true);

    rerender({ tab: 'board' });
    await act(async () => {});
    expect(result.current.unreadIds.board?.has('t1') ?? false).toBe(false);
  });

  it('survives a failing unread endpoint without badges', async () => {
    fetchUnreadMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'board'));
    await waitFor(() => expect(result.current.unread).toEqual({}));
  });
});
