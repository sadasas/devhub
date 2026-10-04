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
  vi.unstubAllGlobals();
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

  it('shows only results while searching (queue hidden)', async () => {
    let resolveSearch!: (v: { results: YoutubeVideo[]; cached: boolean }) => void;
    searchMock.mockImplementationOnce(
      () =>
        new Promise<{ results: YoutubeVideo[]; cached: boolean }>((resolve) => {
          resolveSearch = resolve;
        }),
    );
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    expect(screen.getByText('Queue')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search YouTube songs'), { target: { value: 'lofi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    // Queue + now playing hidden, skeleton in their place.
    expect(screen.queryByText('Queue')).toBeNull();
    expect(screen.queryByText('Now playing')).toBeNull();
    expect(screen.getByText('Searching…')).toBeTruthy();
    await act(async () => {
      resolveSearch({ results: [VID('a')], cached: false });
      await new Promise((r) => setTimeout(r, 0));
    });
    // Results view still exclusive: queue stays hidden until dismissed.
    expect(screen.getByText('Title a')).toBeTruthy();
    expect(screen.queryByText('Queue')).toBeNull();
  });

  it('clears stale results when a new search starts', async () => {
    searchMock.mockResolvedValueOnce({ results: [VID('old')], cached: false });
    let resolveSecond!: (v: { results: YoutubeVideo[]; cached: boolean }) => void;
    searchMock.mockImplementationOnce(
      () =>
        new Promise<{ results: YoutubeVideo[]; cached: boolean }>((resolve) => {
          resolveSecond = resolve;
        }),
    );
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    fireEvent.change(screen.getByLabelText('Search YouTube songs'), { target: { value: 'first' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByText('Title old')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search YouTube songs'), { target: { value: 'second' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.queryByText('Title old')).toBeNull();
    expect(screen.getByText('Searching…')).toBeTruthy();
    await act(async () => {
      resolveSecond({ results: [VID('new')], cached: false });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByText('Title new')).toBeTruthy();
  });

  it('× dismisses results back to the queue view', async () => {
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    expect(screen.getByText('Title a')).toBeTruthy();
    expect(screen.queryByText('Queue')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear results' }));
    expect(screen.queryByText('Title a')).toBeNull();
    expect(screen.getByText('Queue')).toBeTruthy();
    expect(screen.getByText('Queue is empty — add from search results')).toBeTruthy();
    expect((screen.getByLabelText('Search YouTube songs') as HTMLInputElement).value).toBe('');
  });

  it('playing a result dismisses to the queue view and plays', async () => {
    const players = installYTMock();
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
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
    // Results view dismissed: the result play button is gone.
    expect(screen.queryByRole('button', { name: 'Add Title a to queue' })).toBeNull();
    expect(screen.getByText('Now playing')).toBeTruthy();
    expect(screen.getAllByText('Title a')).toHaveLength(3);
  });

  it('adding a result dismisses to the queue without playing', async () => {
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title b to queue' }));
    expect(trackMock).toHaveBeenCalledWith('radio_queue_add', { videoId: 'b' });
    // Dismissed: the results row (add button) is gone; the queue row remains.
    expect(screen.queryByRole('button', { name: 'Add Title b to queue' })).toBeNull();
    expect(within(queueList()).getByText('Title b')).toBeTruthy();
    expect(screen.getByText('Now playing')).toBeTruthy();
    expect(trackMock).not.toHaveBeenCalledWith('radio_play', expect.anything());
  });

  it('removes queue entries', async () => {
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title a to queue' }));
    // Auto-dismissed back to the queue view — search again to add more.
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title b to queue' }));
    expect(within(queueList()).getByText('Title a')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Title a' }));
    expect(trackMock).toHaveBeenCalledWith('radio_queue_remove', { videoId: 'a' });
    expect(within(queueList()).queryByText('Title a')).toBeNull();
    expect(within(queueList()).getByText('Title b')).toBeTruthy();
  });

  it('reorders the queue with drag and drop', async () => {
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title a to queue' }));
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title b to queue' }));
    const rows = queueList().querySelectorAll('li');
    expect(rows).toHaveLength(2);
    const dt = { effectAllowed: '', setData: vi.fn(), getData: vi.fn() };
    fireEvent.dragStart(rows[0]!, { dataTransfer: dt });
    fireEvent.dragOver(rows[1]!);
    fireEvent.drop(rows[1]!);
    expect(trackMock).toHaveBeenCalledWith('radio_queue_move', { videoId: 'a', to: 1 });
    const order = () => Array.from(queueList().querySelectorAll('li')).map((li) => li.textContent ?? '');
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

  it('shows an adblock notice when playback is blocked but keeps skipping', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('blocked by client')),
    );
    searchMock.mockResolvedValue({ results: [VID('a'), VID('b')], cached: false });
    const players = installYTMock();
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    await act(async () => {
      const p = (async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Play Title a' }));
      })();
      await new Promise((r) => setTimeout(r, 0));
      players[0]!.__events.onReady?.({ target: players[0] });
      await p;
    });
    // Queue is [a] — add b (re-search first: adds auto-dismiss) so the error can skip forward.
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title b to queue' }));
    act(() => {
      players[0]!.__events.onError?.({ data: 150 });
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    // Skipped to b AND told the user why.
    expect(players[0]!.loadVideoById).toHaveBeenCalledWith('b');
    expect(screen.getByText('Playback blocked by an ad blocker')).toBeTruthy();
  });

  it('toggles repeat with accent state, dot, event and persistence', async () => {
    const players = installYTMock();
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    await act(async () => {
      const p = (async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Play Title a' }));
      })();
      await new Promise((r) => setTimeout(r, 0));
      players[0]!.__events.onReady?.({ target: players[0] });
      await p;
    });
    const repeatBtn = screen.getByRole('button', { name: 'Repeat queue' });
    expect(repeatBtn.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByTestId('repeat-dot')).toBeNull();
    fireEvent.click(repeatBtn);
    expect(trackMock).toHaveBeenCalledWith('radio_repeat', { on: true });
    expect(screen.getByRole('button', { name: 'Repeat queue' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('repeat-dot')).toBeTruthy();
    expect(window.localStorage.getItem('devhub.focus.radioRepeat')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Repeat queue' }));
    expect(trackMock).toHaveBeenCalledWith('radio_repeat', { on: false });
    expect(screen.getByRole('button', { name: 'Repeat queue' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('shuffles keeping the current track first', async () => {
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title a to queue' }));
    await searchLofi();
    fireEvent.click(screen.getByRole('button', { name: 'Add Title b to queue' }));
    // Queue is [a, b] with a current — shuffle keeps it first.
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle queue' }));
    expect(trackMock).toHaveBeenCalledWith('radio_shuffle');
    const order = () => Array.from(queueList().querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(order()).toHaveLength(2);
    expect(order()[0]).toContain('Title a');
  });
});
