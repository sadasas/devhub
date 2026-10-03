import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAmbientAudio } from './useAmbientAudio';

function makeParam() {
  return { value: 0, setTargetAtTime: vi.fn() };
}

function makeNode(extra: Record<string, unknown> = {}) {
  return { connect: vi.fn(), disconnect: vi.fn(), ...extra };
}

interface MockSource {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

function installAudioMock() {
  const constructed: object[] = [];
  const created: MockSource[] = [];
  // NOTE: plain function (not vi.fn) — vi.fn() mocks are not constructible
  // with `new`, but the hook does `new AudioContext()`.
  function MockAudioContext(this: unknown) {
    const source: MockSource & Record<string, unknown> = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      buffer: null,
      loop: false,
      start: vi.fn(),
      stop: vi.fn(),
    };
    created.push(source);
    const ctx = {
      state: 'running',
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createBuffer: (_ch: number, len: number) => ({
        getChannelData: () => new Float32Array(len),
      }),
      createBufferSource: () => source,
      createBiquadFilter: () => ({ ...makeNode(), type: '', frequency: makeParam(), Q: makeParam() }),
      createGain: () => ({ ...makeNode(), gain: makeParam() }),
      createOscillator: () => ({
        ...makeNode(),
        type: '',
        frequency: makeParam(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    constructed.push(ctx);
    return ctx;
  }
  // NOTE: define on `window` directly — vi.stubGlobal misses the jsdom
  // window object that the hook reads (window.AudioContext).
  Object.defineProperty(window, 'AudioContext', {
    writable: true,
    configurable: true,
    value: MockAudioContext,
  });
  return { constructed, created };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'AudioContext');
  vi.restoreAllMocks();
});

describe('useAmbientAudio', () => {
  it('defaults to rain, stopped, persisted-or-default volume', () => {
    installAudioMock();
    const { result } = renderHook(() => useAmbientAudio());
    expect(result.current.trackId).toBe('rain');
    expect(result.current.playing).toBe(false);
    expect(result.current.volume).toBe(0.7);
  });

  it('toggle starts and stops the voice', () => {
    const { constructed, created } = installAudioMock();
    const { result } = renderHook(() => useAmbientAudio());
    let next = false;
    act(() => {
      next = result.current.toggle();
    });
    expect(next).toBe(true);
    expect(result.current.playing).toBe(true);
    expect(constructed).toHaveLength(1);
    expect(created[0]!.start).toHaveBeenCalled();
    act(() => {
      next = result.current.toggle();
    });
    expect(next).toBe(false);
    expect(result.current.playing).toBe(false);
    expect(created[0]!.stop).toHaveBeenCalled();
  });

  it('switching track while playing rebuilds the graph', () => {
    const { constructed } = installAudioMock();
    const { result } = renderHook(() => useAmbientAudio());
    act(() => {
      result.current.toggle();
    });
    act(() => {
      result.current.setTrackId('waves');
    });
    expect(result.current.trackId).toBe('waves');
    expect(result.current.playing).toBe(true);
    expect(constructed).toHaveLength(2);
  });

  it('clamps and persists volume', () => {
    installAudioMock();
    const { result } = renderHook(() => useAmbientAudio());
    act(() => {
      result.current.setVolume(0.42);
    });
    expect(result.current.volume).toBeCloseTo(0.42);
    expect(window.localStorage.getItem('devhub.focus.musicVolume')).toBe('0.42');
    act(() => {
      result.current.setVolume(9);
    });
    expect(result.current.volume).toBe(1);
    act(() => {
      result.current.setVolume(-3);
    });
    expect(result.current.volume).toBe(0);
  });

  it('is a safe no-op when WebAudio is unavailable', () => {
    const { result } = renderHook(() => useAmbientAudio());
    let next = true;
    act(() => {
      next = result.current.toggle();
    });
    expect(next).toBe(false);
    expect(result.current.playing).toBe(false);
  });
});
