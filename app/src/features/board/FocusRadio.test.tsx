import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { YoutubeVideo } from '../../lib/types';

const { trackMock, searchMock } = vi.hoisted(() => ({ trackMock: vi.fn(), searchMock: vi.fn() }));

vi.mock('../../lib/analytics', () => ({
  track: trackMock,
}));

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

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

const VID = (id: string): YoutubeVideo => ({
  videoId: id,
  title: `Title ${id}`,
  channelTitle: 'NCS',
  thumbnailUrl: '',
});

import { FocusRadio } from './FocusRadio';

beforeEach(() => {
  window.localStorage.clear();
  trackMock.mockReset();
  searchMock.mockReset();
  installYTMock();
  mockMatchMedia(true);
});

afterEach(() => {
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'YT');
  vi.restoreAllMocks();
});

async function searchLofi() {
  searchMock.mockResolvedValue({ results: [VID('a'), VID('b')], cached: false });
  fireEvent.change(screen.getByLabelText('Search YouTube songs'), { target: { value: 'lofi' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('FocusRadio', () => {
  it('renders the pill and opens the sheet', () => {
    render(<FocusRadio />);
    expect(screen.getByRole('button', { name: 'Radio' })).toBeTruthy();
    expect(screen.queryByLabelText('Search YouTube songs')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    expect(screen.getByLabelText('Search YouTube songs')).toBeTruthy();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('searches, lists results, and plays the picked track with events', async () => {
    const players = installYTMock();
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    expect(trackMock).toHaveBeenCalledWith('radio_search');
    // Pill label + result row + now-playing title (current is set on search).
    expect(screen.getAllByText('Title a')).toHaveLength(3);
    await act(async () => {
      const p = (async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Play Title a' }));
      })();
      await new Promise((r) => setTimeout(r, 0));
      players[0]!.__events.onReady?.({ target: players[0] });
      await p;
    });
    expect(players[0]!.loadVideoById).toHaveBeenCalledWith('a');
    expect(trackMock).toHaveBeenCalledWith('radio_play', { videoId: 'a' });
    expect(screen.getByText('Now playing')).toBeTruthy();
    expect(players[0]!.setVolume).toHaveBeenCalledWith(70);
  });

  it('shows quota errors with a synth fallback hint', async () => {
    searchMock.mockRejectedValue(Object.assign(new Error('q'), { code: 'YOUTUBE_QUOTA_EXHAUSTED' }));
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    fireEvent.change(screen.getByLabelText('Search YouTube songs'), { target: { value: 'lofi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('YouTube search quota exhausted, try again tomorrow')).toBeTruthy();
  });
});
