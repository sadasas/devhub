import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { trackMock } = vi.hoisted(() => ({ trackMock: vi.fn() }));

vi.mock('../../lib/analytics', () => ({
  track: trackMock,
  useFeatureFlag: (_key: string, fallback: boolean) => fallback,
  FOCUS_MODE_FLAG: 'focus-mode-enabled',
}));

function installAudioMock() {
  // NOTE: plain function (not vi.fn) — vi.fn() mocks are not constructible
  // with `new`, but the hook does `new AudioContext()`.
  function MockAudioContext(this: unknown) {
    return {
      state: 'running',
      currentTime: 0,
      sampleRate: 44100,
      destination: {},
      createBuffer: (_ch: number, len: number) => ({
        getChannelData: () => new Float32Array(len),
      }),
      createBufferSource: () => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        buffer: null,
        loop: false,
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createBiquadFilter: () => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        type: '',
        frequency: { value: 0 },
        Q: { value: 0 },
      }),
      createGain: () => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        gain: { value: 0 },
      }),
      createOscillator: () => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
        type: '',
        frequency: { value: 0 },
        start: vi.fn(),
        stop: vi.fn(),
      }),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
  }
  // NOTE: define on `window` directly — vi.stubGlobal misses the jsdom
  // window object that the hook reads (window.AudioContext).
  Object.defineProperty(window, 'AudioContext', {
    writable: true,
    configurable: true,
    value: MockAudioContext,
  });
}

import { FocusMusic } from './FocusMusic';
import { useAmbientAudio } from './useAmbientAudio';

/** Host with the real lifted hook (as FocusTimer provides it). */
function renderMusic() {
  function Host() {
    const music = useAmbientAudio();
    return <FocusMusic music={music} />;
  }
  render(<Host />);
}

beforeEach(() => {
  window.localStorage.clear();
  trackMock.mockReset();
  installAudioMock();
});

afterEach(() => {
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'AudioContext');
  vi.restoreAllMocks();
});

describe('FocusMusic', () => {
  it('renders the section, default track and volume', () => {
    renderMusic();
    expect(screen.getByText('Music')).toBeTruthy();
    expect(screen.getByLabelText('Ambient track')).toBeTruthy();
    expect(screen.getByLabelText('Volume')).toBeTruthy();
    expect(screen.getByText('70%')).toBeTruthy();
  });

  it('toggles playback and tracks music_start / music_stop with the track', () => {
    renderMusic();
    const play = screen.getByRole('button', { name: 'Play' });
    fireEvent.click(play);
    expect(trackMock).toHaveBeenCalledWith('music_start', { track: 'rain' });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(trackMock).toHaveBeenCalledWith('music_stop', { track: 'rain' });
  });

  it('changes volume and persists it', () => {
    renderMusic();
    const slider = screen.getByLabelText('Volume') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '42' } });
    expect(screen.getByText('42%')).toBeTruthy();
    expect(window.localStorage.getItem('devhub.focus.musicVolume')).toBe('0.42');
  });
});
