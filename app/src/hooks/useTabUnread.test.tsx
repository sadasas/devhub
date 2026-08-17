import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTabUnread } from './useTabUnread';

const subscribeMock = vi.hoisted(() => vi.fn());
const fetchActivityMock = vi.hoisted(() => vi.fn());

vi.mock('../state/project-context', () => ({
  useProject: () => ({ subscribeActivity: subscribeMock }),
}));

vi.mock('../lib/api', () => ({
  api: { fetchActivity: fetchActivityMock },
}));

const KEY = 'devhub:unread:p1:u1';
const DISMISS_KEY = 'devhub:deleted-dismiss:p1';

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

describe('useTabUnread', () => {
  beforeEach(() => {
    localStorage.clear();
    subscribeMock.mockReset();
    subscribeMock.mockReturnValue(() => {});
    fetchActivityMock.mockReset();
  });

  it('counts activity newer than the stored last read per tab', async () => {
    localStorage.setItem(KEY, JSON.stringify({ board: '2099-01-01T01:00:00.000Z' }));
    fetchActivityMock.mockResolvedValue([
      activity({ id: 'a1', entity: 'tasks', createdAt: '2099-01-02T00:00:00.000Z' }),
      activity({ id: 'a2', entity: 'issues', createdAt: '2098-12-31T00:00:00.000Z' }),
      activity({ id: 'a3', entity: 'whiteboards', createdAt: '2099-01-02T00:00:00.000Z' }),
    ]);
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'board'));
    await waitFor(() =>
      expect(result.current.unread).toEqual({ board: 1, issues: 1, whiteboard: 1 }),
    );
  });

  it('persists the last read boundary when the active tab changes', async () => {
    fetchActivityMock.mockResolvedValue([]);
    const { rerender } = renderHook(({ tab }) => useTabUnread('p1', 'u1', tab), {
      initialProps: { tab: 'board' },
    });
    await act(async () => {});
    const first = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(typeof first.board).toBe('string');

    rerender({ tab: 'issues' });
    await act(async () => {});
    const second = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(typeof second.issues).toBe('string');
  });

  it('increments live activity on other tabs and ignores the active tab', async () => {
    fetchActivityMock.mockResolvedValue([]);
    let cb: (msg: { entry: ReturnType<typeof activity> }) => void = () => {};
    subscribeMock.mockImplementation((fn: typeof cb) => {
      cb = fn;
      return () => {};
    });
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'issues'));
    await act(async () => {});
    expect(result.current.unread).toEqual({});

    act(() => cb({ entry: activity({ entity: 'tasks' }) }));
    expect(result.current.unread.board).toBe(1);

    act(() => cb({ entry: activity({ entity: 'issues' }) }));
    expect(result.current.unread.issues ?? 0).toBe(0);
  });

  it('collects deleted entries from fetch and live events', async () => {
    fetchActivityMock.mockResolvedValue([
      activity({ id: 'a1', action: 'deleted', summary: 'Old task' }),
      activity({ id: 'a2', action: 'updated' }),
    ]);
    let cb: (msg: { entry: ReturnType<typeof activity> }) => void = () => {};
    subscribeMock.mockImplementation((fn: typeof cb) => {
      cb = fn;
      return () => {};
    });
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'issues'));
    await waitFor(() => expect(result.current.deleted.length).toBe(1));
    expect(result.current.deleted[0]?.summary).toBe('Old task');

    act(() => cb({ entry: activity({ id: 'a9', action: 'deleted', summary: 'Live task' }) }));
    expect(result.current.deleted.map((d) => d.summary)).toEqual(['Old task', 'Live task']);
  });

  it('dismisses the deleted banner persistently', async () => {
    fetchActivityMock.mockResolvedValue([activity({ id: 'a1', action: 'deleted' })]);
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'board'));
    await waitFor(() => expect(result.current.dismissedUntil).toBeNull());
    act(() => result.current.dismissDeleted());
    expect(result.current.dismissedUntil).not.toBeNull();
    expect(localStorage.getItem(DISMISS_KEY)).not.toBeNull();
  });

  it('exposes the unread entity ids per tab from fetched activity', async () => {
    localStorage.setItem(KEY, JSON.stringify({ board: '2099-01-01T01:00:00.000Z' }));
    fetchActivityMock.mockResolvedValue([
      activity({ id: 'a1', entity: 'tasks', entityId: 't1', createdAt: '2099-01-02T00:00:00.000Z' }),
      activity({ id: 'a2', entity: 'tasks', entityId: 't2', createdAt: '2098-12-30T00:00:00.000Z' }),
      activity({ id: 'a3', entity: 'issues', entityId: 'i9', createdAt: '2099-01-02T00:00:00.000Z' }),
    ]);
    const { result } = renderHook(() => useTabUnread('p1', 'u1', 'issues'));
    await waitFor(() => expect(result.current.unreadIds.board?.has('t1')).toBe(true));
    expect(result.current.unreadIds.board?.has('t2')).toBe(false);
    expect(result.current.unreadIds.issues?.has('i9')).toBe(true);
  });

  it('adds live entity ids for other tabs and clears them when the tab is visited', async () => {
    fetchActivityMock.mockResolvedValue([]);
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
    expect(result.current.unreadIds.board?.has('t1')).toBe(false);
  });
});