import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRadioPlayer, loadYouTubeIframeAPI } from './youtube-radio';

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

afterEach(() => {
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'YT');
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'onYouTubeIframeAPIReady');
  vi.restoreAllMocks();
});

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

describe('youtube-radio (YT IFrame wrapper)', () => {
  it('resolves immediately when the API is already present', async () => {
    installYTMock();
    const scriptsBefore = document.head.querySelectorAll('script').length;
    const YT = await loadYouTubeIframeAPI();
    expect(YT.Player).toBeTruthy();
    expect(document.head.querySelectorAll('script').length).toBe(scriptsBefore);
  });

  it('creates a visible player, applies volume, and maps states', async () => {
    const players = installYTMock();
    const el = document.createElement('div');
    const states: string[] = [];
    const creating = createRadioPlayer(el, { volume: 0.42 });
    await flush();
    expect(players).toHaveLength(1);
    let handle!: Awaited<ReturnType<typeof createRadioPlayer>>;
    const ready = creating.then((h) => {
      handle = h;
    });
    players[0]!.__events.onReady?.({ target: players[0] });
    await ready;
    expect(players[0]!.setVolume).toHaveBeenCalledWith(42);

    handle.onState((s) => states.push(s));
    players[0]!.__events.onStateChange?.({ data: 1, target: players[0] });
    players[0]!.__events.onStateChange?.({ data: 2, target: players[0] });
    players[0]!.__events.onStateChange?.({ data: 0, target: players[0] });
    expect(states).toEqual(['playing', 'paused', 'ended']);

    handle.playTrack('vid1');
    expect(players[0]!.loadVideoById).toHaveBeenCalledWith('vid1');
    handle.play();
    expect(players[0]!.playVideo).toHaveBeenCalledTimes(1);
    handle.pause();
    expect(players[0]!.pauseVideo).toHaveBeenCalledTimes(1);
    handle.setVolume(0.7);
    expect(players[0]!.setVolume).toHaveBeenLastCalledWith(70);
    handle.destroy();
    expect(players[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('forwards player errors', async () => {
    const players = installYTMock();
    const creating = createRadioPlayer(document.createElement('div'), { volume: 0.5 });
    await flush();
    let handle!: Awaited<ReturnType<typeof createRadioPlayer>>;
    const ready = creating.then((h) => {
      handle = h;
    });
    players[0]!.__events.onReady?.({ target: players[0] });
    await ready;
    const codes: number[] = [];
    handle.onError((c) => codes.push(c));
    players[0]!.__events.onError?.({ data: 150 });
    expect(codes).toEqual([150]);
  });
});
