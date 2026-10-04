import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

function queueList() {
  return screen.getByRole('list', { name: 'Queue' });
}

describe('FocusRadio', () => {
  it('renders the pill and opens the sheet with an empty queue', () => {
    render(<FocusRadio />);
    expect(screen.getByRole('button', { name: 'Radio' })).toBeTruthy();
    expect(screen.queryByLabelText('Search YouTube songs')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    expect(screen.getByLabelText('Search YouTube songs')).toBeTruthy();
    expect(screen.getByText('Queue is empty — add from search results')).toBeTruthy();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('searches without touching the queue, then plays a picked track', async () => {
    const players = installYTMock();
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    expect(trackMock).toHaveBeenCalledWith('radio_search');
    // Row only — queue is still empty, pill still shows "Radio".
    expect(screen.getAllByText('Title a')).toHaveLength(1);
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
    // Pill + result row + queue row + now playing.
    expect(screen.getAllByText('Title a')).toHaveLength(4);
  });

  it('adds results to the queue without playing', async () => {
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title b to queue' }));
    expect(trackMock).toHaveBeenCalledWith('radio_queue_add', { videoId: 'b' });
    const q = queueList();
    expect(within(q).getByText('Title b')).toBeTruthy();
    // Nothing started playing.
    expect(screen.getByText('Pick a song to start')).toBeTruthy();
    expect(trackMock).not.toHaveBeenCalledWith('radio_play', expect.anything());
  });

  it('removes queue entries', async () => {
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title a to queue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Title b to queue' }));
    expect(within(queueList()).getByText('Title a')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Title a' }));
    expect(trackMock).toHaveBeenCalledWith('radio_queue_remove', { videoId: 'a' });
    expect(within(queueList()).queryByText('Title a')).toBeNull();
    expect(within(queueList()).getByText('Title b')).toBeTruthy();
  });

  it('reorders the queue with up/down buttons', async () => {
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title a to queue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Title b to queue' }));
    const q = () => queueList();
    const order = () =>
      Array.from(q().querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(order()[0]).toContain('Title a');
    // Move b (index 1) up → b first.
    const upButtons = within(q()).getAllByRole('button', { name: 'Move up' });
    fireEvent.click(upButtons[1]!);
    expect(trackMock).toHaveBeenCalledWith('radio_queue_move', { videoId: 'b', to: 0 });
    expect(order()[0]).toContain('Title b');
  });

  it('reorders the queue with drag and drop', async () => {
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title a to queue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Title b to queue' }));
    const rows = queueList().querySelectorAll('li');
    expect(rows).toHaveLength(2);
    const dt = { effectAllowed: '', setData: vi.fn(), getData: vi.fn() };
    fireEvent.dragStart(rows[0]!, { dataTransfer: dt });
    fireEvent.dragOver(rows[1]!);
    fireEvent.drop(rows[1]!);
    expect(trackMock).toHaveBeenCalledWith('radio_queue_move', { videoId: 'a', to: 1 });
    const order = Array.from(queueList().querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(order()[0]).toContain('Title b');
  });

  it('shows quota errors', async () => {
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
