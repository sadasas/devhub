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
    ids: {} as Record<string, unknown>,
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
    action: 'created' as const,
    authorId: 'u1',
    authorName: 'Ana',
    summary: 'Build login',
    changes: {} as Record<string, { from: unknown; to: unknown }>,
    createdAt: '2099-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('useTabUnread (server-side M38: new+deleted, hilang saat pindah tab)', () => {
  beforeEach(() => {
    localStorage.clear();
    subscribeMock.mockReset();
    subscribeMock.mockReturnValue(() => {});
    fetchUnreadMock.mockReset();
    fetchUnreadMock.mockResolvedValue(summary());
    setWatermarkMock.mockReset();
    setWatermarkMock.mockResolvedValue({ ok: true });
  });

  it('adopts server counts and keeps the active tab (not stripped)', async () => {
    fetchUnreadMock.mockResolvedValue(
      summary({
        counts: { board: { new: 2, deleted: 0, total: 2 }, issues: { new: 1, deleted: 0, total: 1 }, tests: { new: 3, deleted: 0, total: 3 } },
        ids: { board: { new: ['t1', 't2'], deleted: [] }, issues: { new: ['i9'], deleted: [] } },
        watermarks: { board: '2026-08-01T00:00:00.000Z' },
      }),
    );

    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'board'));
    await waitFor(() => expect(result.current.unread.board?.new).toBe(2));
    expect(result.current.unread.issues?.new).toBe(1);
    expect((result.current.unreadIds as any).board?.new?.has('t1')).toBe(true);
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
    await waitFor(() => expect((result.current.dismissedUntil as any).board).toBe('2026-08-02T00:00:00.000Z'));
    await waitFor(() =>
      expect(setWatermarkMock).toHaveBeenCalledWith('p1', 'board'),
    );
    expect(setWatermarkMock).toHaveBeenCalledWith('p1', '__deleted_dismiss__:board');
    expect(localStorage.getItem('devhub:unread:p1:u1')).toBeNull();
    expect(localStorage.getItem('devhub:deleted-dismiss:p1')).toBeNull();
  });

  it('marks the left tab read via debounced PUT and clears its badge locally', async () => {
    vi.useFakeTimers();
    try {
      fetchUnreadMock.mockResolvedValue(
        summary({ counts: { board: { new: 4, deleted: 0, total: 4 } }, ids: { board: { new: ['t1'], deleted: [] } } }),
      );
      const { result, rerender } = renderHook(({ tab }) => useTabUnread('p1', 'u1', tab), {
        initialProps: { tab: 'board' },
      });
      await act(async () => {});
      expect(result.current.unread.board?.new).toBe(4); // active tab tetap ada (hilang saat pindah, bukan saat buka)

      rerender({ tab: 'issues' });
      await act(async () => {});
      expect(setWatermarkMock).not.toHaveBeenCalled(); // belum melewati debounce

      await vi.advanceTimersByTimeAsync(600);
      expect(setWatermarkMock).toHaveBeenCalledWith('p1', 'board');
      // board should be cleared after leave
      expect(result.current.unread.board).toBeUndefined();
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

    act(() => cb({ entry: activity({ entity: 'tasks', action: 'created' }) }));
    expect(result.current.unread.board?.new).toBe(1);

    act(() => cb({ entry: activity({ entity: 'issues', action: 'created' }) }));
    expect(result.current.unread.issues?.new ?? 0).toBe(0);

    // updated diabaikan (M38)
    act(() => cb({ entry: activity({ entity: 'tasks', action: 'updated' }) }));
    expect(result.current.unread.board?.new).toBe(1);
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
            tab: 'board',
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

  it('dismisses the deleted banner on the server per tab', async () => {
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'board'));
    await act(async () => {});
    act(() => (result.current.dismissDeleted as any)('board'));
    expect((result.current.dismissedUntil as any).board).not.toBeNull();
    expect(setWatermarkMock).toHaveBeenCalledWith('p1', '__deleted_dismiss__:board');
  });

  it('adds live entity ids for other tabs and clears them when the tab is left', async () => {
    let cb: (msg: { entry: ReturnType<typeof activity> }) => void = () => {};
    subscribeMock.mockImplementation((fn: typeof cb) => {
      cb = fn;
      return () => {};
    });
    const { result, rerender } = renderHook(({ tab }) => useTabUnread('p1', 'u1', tab), {
      initialProps: { tab: 'issues' },
    });
    await act(async () => {});
    act(() => cb({ entry: activity({ entity: 'tasks', entityId: 't1', action: 'created' }) }));
    expect((result.current.unreadIds as any).board?.new?.has('t1')).toBe(true);

    rerender({ tab: 'board' });
    await act(async () => {});
    // board masih ada (baru dibuka), issues yang hilang (prev)
    expect((result.current.unreadIds as any).board?.new?.has('t1') ?? false).toBe(true);
    expect((result.current.unreadIds as any).issues).toBeUndefined();
  });

  it('survives a failing unread endpoint without badges', async () => {
    fetchUnreadMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'board'));
    await waitFor(() => expect(result.current.unread).toEqual({}));
  });
});
