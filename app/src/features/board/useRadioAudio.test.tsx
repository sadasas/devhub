import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { YoutubeVideo } from '../../lib/types';

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));

vi.mock('../../lib/api', () => ({
  api: { youtubeSearch: searchMock },
}));

interface MockEvents {
  onReady?: (e: { target: unknown }) => void;
  onStateChange?: (e: { data: number; target: unknown }) => void;
  onError?: (e: { data: number }) => void;
}

interface MockPlayer {
  playVideo: ReturnType<typeof vi.fn>;
  pauseVideo: ReturnType<typeof vi.fn>;
  loadVideoById: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  __events: MockEvents;
}

function installYTMock() {
  const players: MockPlayer[] = [];
  // NOTE: plain function — vi.fn() mocks are not constructible with `new`.
  function MockPlayer(this: unknown, _el: unknown, opts: { events?: MockEvents }) {
    const p: MockPlayer = {
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      loadVideoById: vi.fn(),
      setVolume: vi.fn(),
      destroy: vi.fn(),
      __events: opts.events ?? {},
    };
    players.push(p);
    return p;
  }
  Object.defineProperty(window, 'YT', {
    writable: true,
    configurable: true,
    value: { Player: MockPlayer },
  });
  return players;
}

const VID = (id: string): YoutubeVideo => ({
  videoId: id,
  title: `Title ${id}`,
  channelTitle: 'NCS',
  thumbnailUrl: '',
});

import { useRadioAudio } from './useRadioAudio';

/** The hook needs a mounted container like the real panel provides. */
function attachContainer(result: { current: { containerRef: { current: HTMLDivElement | null } } }) {
  act(() => {
    result.current.containerRef.current = document.createElement('div');
  });
}

async function tick() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  searchMock.mockReset();
  installYTMock();
});

afterEach(() => {
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'YT');
  vi.restoreAllMocks();
});

describe('useRadioAudio', () => {
  it('search fills results but leaves the queue untouched', async () => {
    searchMock.mockResolvedValue({ results: [VID('a'), VID('b')], cached: false });
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    let out: YoutubeVideo[] = [];
    await act(async () => {
      out = await result.current.search('lofi');
    });
    expect(out).toHaveLength(2);
    expect(searchMock).toHaveBeenCalledWith('lofi');
    expect(result.current.results).toHaveLength(2);
    expect(result.current.queue).toEqual([]);
    expect(result.current.searched).toBe(true);
    expect(result.current.playing).toBe(false);
  });

  it('ignores blank queries without touching the API', async () => {
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    let out: YoutubeVideo[] = [];
    await act(async () => {
      out = await result.current.search('   ');
    });
    expect(out).toEqual([]);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('maps quota errors and keeps state untouched', async () => {
    searchMock.mockRejectedValue(Object.assign(new Error('q'), { code: 'YOUTUBE_QUOTA_EXHAUSTED' }));
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    await act(async () => {
      await result.current.search('lofi');
    });
    expect(result.current.error).toBe('quota');
    expect(result.current.results).toEqual([]);
  });

  it('maps missing-key to not-configured', async () => {
    searchMock.mockRejectedValue(Object.assign(new Error('x'), { code: 'YOUTUBE_NOT_CONFIGURED' }));
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    await act(async () => {
      await result.current.search('lofi');
    });
    expect(result.current.error).toBe('not-configured');
  });

  it('enqueue appends and dedups by videoId', () => {
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    let i0 = -1;
    let i1 = -1;
    let dup = -1;
    act(() => {
      i0 = result.current.enqueue(VID('a'));
      i1 = result.current.enqueue(VID('b'));
      dup = result.current.enqueue(VID('a'));
    });
    expect(i0).toBe(0);
    expect(i1).toBe(1);
    expect(dup).toBe(0);
    expect(result.current.queue.map((v) => v.videoId)).toEqual(['a', 'b']);
  });

  it('removeAt fixes the index and stops when the current track goes', async () => {
    const players = installYTMock();
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    act(() => {
      result.current.enqueue(VID('a'));
      result.current.enqueue(VID('b'));
      result.current.enqueue(VID('c'));
    });
    // Play middle track, then remove the one before it → index shifts down.
    let box: { track: YoutubeVideo | null } = { track: null };
    await act(async () => {
      const p = result.current.playAt(1);
      await new Promise((r) => setTimeout(r, 0));
      players[0]!.__events.onReady?.({ target: players[0] });
      box.track = await p;
    });
    expect(box.track?.videoId).toBe('b');
    let removed!: YoutubeVideo | null;
    act(() => {
      removed = result.current.removeAt(0);
    });
    expect(removed?.videoId).toBe('a');
    expect(result.current.queue.map((v) => v.videoId)).toEqual(['b', 'c']);
    expect(result.current.index).toBe(0);
    expect(result.current.playing).toBe(true);
    // Remove the playing track → stops.
    act(() => {
      removed = result.current.removeAt(0);
    });
    expect(removed?.videoId).toBe('b');
    expect(result.current.playing).toBe(false);
    expect(players[0]!.pauseVideo).toHaveBeenCalled();
    expect(result.current.queue.map((v) => v.videoId)).toEqual(['c']);
  });

  it('move reorders and tracks the playing position', () => {
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    act(() => {
      result.current.enqueue(VID('a'));
      result.current.enqueue(VID('b'));
      result.current.enqueue(VID('c'));
    });
    let moved = false;
    act(() => {
      moved = result.current.move(0, 2);
    });
    expect(moved).toBe(true);
    expect(result.current.queue.map((v) => v.videoId)).toEqual(['b', 'c', 'a']);
    expect(result.current.index).toBe(0);
    act(() => {
      moved = result.current.move(1, 1);
    });
    expect(moved).toBe(false);
    act(() => {
      moved = result.current.move(0, 9);
    });
    expect(moved).toBe(false);
  });

  it('playAt loads the video once the player is ready', async () => {
    const players = installYTMock();
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    act(() => {
      result.current.enqueue(VID('a'));
      result.current.enqueue(VID('b'));
    });
    const box: { track: YoutubeVideo | null } = { track: null };
    await act(async () => {
      const p = result.current.playAt(0);
      await new Promise((r) => setTimeout(r, 0)); // let the constructor run
      players[0]!.__events.onReady?.({ target: players[0] });
      box.track = await p;
    });
    expect(box.track?.videoId).toBe('a');
    expect(players[0]!.loadVideoById).toHaveBeenCalledWith('a');
    expect(result.current.playing).toBe(true);
    expect(result.current.index).toBe(0);
  });

  it('ignores a late player ready after release (close race, no DOM warning)', async () => {
    const players = installYTMock();
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    act(() => {
      result.current.enqueue(VID('a'));
    });
    let pending!: Promise<YoutubeVideo | null>;
    act(() => {
      pending = result.current.playAt(0);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0)); // constructor ran
    });
    expect(players).toHaveLength(1);
    act(() => {
      result.current.release(); // panel closed before ready
    });
    const box: { track: YoutubeVideo | null | undefined } = { track: undefined };
    await act(async () => {
      players[0]!.__events.onReady?.({ target: players[0] });
      box.track = await pending;
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(box.track).toBeNull();
    expect(players[0]!.loadVideoById).not.toHaveBeenCalled();
    expect(result.current.playing).toBe(false);
  });

  it('auto-advances on ended and stops at the end of the queue', async () => {
    const players = installYTMock();
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    act(() => {
      result.current.enqueue(VID('a'));
      result.current.enqueue(VID('b'));
    });
    await act(async () => {
      const p = result.current.playAt(0);
      await new Promise((r) => setTimeout(r, 0));
      players[0]!.__events.onReady?.({ target: players[0] });
      await p;
    });
    act(() => {
      players[0]!.__events.onStateChange?.({ data: 0, target: players[0] });
    });
    expect(result.current.index).toBe(1);
    expect(players[0]!.loadVideoById).toHaveBeenCalledWith('b');
    expect(result.current.playing).toBe(true);
    act(() => {
      players[0]!.__events.onStateChange?.({ data: 0, target: players[0] });
    });
    expect(result.current.index).toBe(1);
    expect(result.current.playing).toBe(false);
  });

  it('skips unplayable tracks and only errors when nothing is left', async () => {
    const players = installYTMock();
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    act(() => {
      result.current.enqueue(VID('a'));
      result.current.enqueue(VID('b'));
    });
    await act(async () => {
      const p = result.current.playAt(0);
      await new Promise((r) => setTimeout(r, 0));
      players[0]!.__events.onReady?.({ target: players[0] });
      await p;
    });
    // Middle-track error (ad-blocked / embedding-restricted): auto-advance, no error box.
    act(() => {
      players[0]!.__events.onError?.({ data: 150 });
    });
    expect(result.current.index).toBe(1);
    expect(players[0]!.loadVideoById).toHaveBeenCalledWith('b');
    expect(result.current.error).toBeNull();
    expect(result.current.playing).toBe(true);
    // Last-track error: nowhere to go → error box.
    act(() => {
      players[0]!.__events.onError?.({ data: 150 });
    });
    expect(result.current.error).toBe('player');
    expect(result.current.playing).toBe(false);
  });

  it('persists volume and applies it live', async () => {
    const players = installYTMock();
    const { result } = renderHook(() => useRadioAudio());
    attachContainer(result);
    act(() => {
      result.current.setVolume(0.42);
    });
    expect(result.current.volume).toBeCloseTo(0.42);
    expect(window.localStorage.getItem('devhub.focus.musicVolume')).toBe('0.42');
    act(() => {
      result.current.enqueue(VID('a'));
    });
    await act(async () => {
      const p = result.current.playAt(0);
      await new Promise((r) => setTimeout(r, 0));
      players[0]!.__events.onReady?.({ target: players[0] });
      await p;
    });
    expect(players[0]!.setVolume).toHaveBeenCalledWith(42);
    act(() => {
      result.current.setVolume(0.9);
    });
    expect(players[0]!.setVolume).toHaveBeenLastCalledWith(90);
  });

  it('destroys the player on unmount', async () => {
    const players = installYTMock();
    const { result, unmount } = renderHook(() => useRadioAudio());
    attachContainer(result);
    act(() => {
      result.current.enqueue(VID('a'));
    });
    await act(async () => {
      const p = result.current.playAt(0);
      await new Promise((r) => setTimeout(r, 0));
      players[0]!.__events.onReady?.({ target: players[0] });
      await p;
    });
    unmount();
    expect(players[0]!.destroy).toHaveBeenCalledTimes(1);
  });
});
