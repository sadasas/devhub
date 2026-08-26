import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { ChatMessage } from '../../lib/types';
import type { TeamChatSocketOptions } from '../../lib/realtime-client';
import { ChatPanel } from './ChatPanel';

const api = vi.hoisted(() => ({
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  deleteMessage: vi.fn(),
  search: vi.fn(),
  resolveChatRefs: vi.fn(),
}));

const sockets = vi.hoisted(() => [] as TeamChatSocketOptions[]);

const idb = vi.hoisted(() => ({
  getMeta: vi.fn(),
  putMeta: vi.fn(),
}));

const { ApiError } = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      void code;
    }
  }
  return { ApiError };
});

vi.mock('../../lib/api', () => ({
  api,
  ApiError,
}));

vi.mock('../../lib/idb', () => idb);

vi.mock('../../lib/realtime-client', () => ({
  realtimeWsUrl: () => 'ws://test/ws',
  TeamChatSocket: class {
    constructor(opts: TeamChatSocketOptions) {
      sockets.push(opts);
    }
    close() {}
  },
}));

type IntersectionCb = (entries: Array<{ isIntersecting: boolean }>) => void;

const observers = vi.hoisted(() => [] as IntersectionCb[]);

function stubIntersectionObserver() {
  class FakeIO {
    constructor(cb: IntersectionCb) {
      observers.push(cb);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  (globalThis as Record<string, unknown>).IntersectionObserver = FakeIO;
}

function message(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    teamId: 't1',
    authorId: 'u1',
    authorName: 'Ana',
    content: 'Hello',
    refs: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderPanel(entries: string[] = ['/teams/t1']) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <LocationProbe />
      <ChatPanel teamId="t1" userId="u1" userDisplayName="Ana" />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const loc = useLocation();
  return <span data-testid="loc">{loc.pathname}{loc.search}</span>;
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listMessages.mockReset().mockResolvedValue({ messages: [], nextCursor: null });
  api.sendMessage.mockReset();
  api.deleteMessage.mockReset();
  api.search.mockReset().mockResolvedValue([]);
  api.resolveChatRefs.mockReset().mockResolvedValue([]);
  idb.getMeta.mockReset().mockResolvedValue(null);
  idb.putMeta.mockReset().mockResolvedValue(undefined);
  sockets.length = 0;
  observers.length = 0;
  stubIntersectionObserver();
});

describe('ChatPanel', () => {
  it('shows the empty state when there are no messages', async () => {
    renderPanel();
    expect(await screen.findByText('No messages yet')).toBeTruthy();
  });

  it('sends a message optimistically and replaces the local bubble', async () => {
    const saved = message({ id: 'm2', content: 'Halo tim' });
    api.sendMessage.mockResolvedValue(saved);
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'Halo tim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Halo tim')).toBeTruthy();
    expect(api.sendMessage).toHaveBeenCalledWith('t1', 'Halo tim', []);
    await waitFor(() => {
      expect(screen.getByText('Halo tim').closest('.chat-msg')?.className).not.toContain('chat-msg-pending');
    });
  });

  it('keeps the failed bubble with Retry and Dismiss actions when sending fails', async () => {
    api.sendMessage.mockRejectedValue(new Error('boom'));
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'Gagal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(screen.getByText('Gagal').closest('.chat-msg')?.className).toContain('chat-msg-failed');
    });
    expect(screen.getByText(/failed to send message/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });

  it('appends messages pushed over the websocket', async () => {
    renderPanel();
    await screen.findByText('No messages yet');

    sockets[0]!.onMessageNew?.('t1', message({ id: 'm9', authorId: 'u2', authorName: 'Budi', content: 'Halo Ana' }));

    expect(await screen.findByText('Halo Ana')).toBeTruthy();
    expect(screen.getByText('Budi')).toBeTruthy();
  });

  it('loads the previous page when the sentinel is reached', async () => {
    const first = Array.from({ length: 30 }, (_, i) => message({ id: `p${i}`, content: `pesan ${i}` }));
    api.listMessages.mockResolvedValueOnce({ messages: first, nextCursor: 'c1' });
    api.listMessages.mockResolvedValueOnce({
      messages: [message({ id: 'old1', content: 'pesan lama' })],
      nextCursor: null,
    });
    renderPanel();
    expect(await screen.findByText('pesan 29')).toBeTruthy();

    observers[observers.length - 1]?.([{ isIntersecting: true }]);
    expect(await screen.findByText('pesan lama')).toBeTruthy();
    expect(api.listMessages).toHaveBeenLastCalledWith('t1', { limit: 30, before: 'c1' });
  });

  it('deletes own messages and hides the delete button for others', async () => {
    api.listMessages.mockResolvedValue({
      messages: [
        message({ id: 'own', authorId: 'u1', content: 'punyaku' }),
        message({ id: 'other', authorId: 'u2', content: 'punyanya' }),
      ],
      nextCursor: null,
    });
    renderPanel();
    expect(await screen.findByText('punyaku')).toBeTruthy();

    const buttons = screen.getAllByRole('button', { name: 'Delete message' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    await waitFor(() => {
      expect(screen.queryByText('punyaku')).toBeNull();
    });
    expect(screen.getByText('punyanya')).toBeTruthy();
    expect(api.deleteMessage).toHaveBeenCalledWith('t1', 'own');
  });

  it('shows a retryable inline error when deleting fails', async () => {
    api.listMessages.mockResolvedValue({
      messages: [message({ id: 'own', authorId: 'u1', content: 'punyaku' })],
      nextCursor: null,
    });
    api.deleteMessage.mockRejectedValue(new ApiError(500, 'INTERNAL', 'boom'));

    renderPanel();
    expect(await screen.findByText('punyaku')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete message' }));

    expect(await screen.findByText(/Not deleted/)).toBeTruthy();
    expect(screen.getByText('punyaku')).toBeTruthy();

    api.deleteMessage.mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(screen.queryByText('punyaku')).toBeNull();
    });
    expect(api.deleteMessage).toHaveBeenCalledTimes(2);
  });

  it('keeps the optimistic bubble queued when sending fails with a network error', async () => {
    api.sendMessage.mockRejectedValue(new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?'));
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'Halo tim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    const textNode = await screen.findByText('Halo tim');
    await waitFor(() => {
      expect(textNode.closest('.chat-msg')!.className).toContain('chat-msg-pending');
    });
    expect(idb.putMeta).toHaveBeenCalledWith('chatQueue:t1', [expect.objectContaining({ clientId: expect.stringMatching(/^local-/), content: 'Halo tim' })]);
    expect(screen.queryByText(/failed to send/i)).toBeNull();
  });

  it('flushes the queued message when the browser comes back online', async () => {
    const saved = message({ id: 'm2', content: 'Halo tim' });
    api.sendMessage
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?'))
      .mockResolvedValueOnce(saved);
    api.listMessages
      .mockResolvedValueOnce({ messages: [], nextCursor: null })
      .mockResolvedValue({ messages: [saved], nextCursor: null });
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'Halo tim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => {
      expect(idb.putMeta).toHaveBeenCalledWith('chatQueue:t1', [expect.anything()]);
    });

    window.dispatchEvent(new Event('online'));
    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getByText('Halo tim').className).not.toContain('chat-msg-pending');
    });
    expect(idb.putMeta).toHaveBeenCalledWith('chatQueue:t1', []);
  });

  it('refetches the list after the websocket rejoins the team room', async () => {
    renderPanel();
    await screen.findByText('No messages yet');
    expect(api.listMessages).toHaveBeenCalledTimes(1);

    sockets[0]!.onJoinedTeam?.();
    await waitFor(() => {
      expect(api.listMessages).toHaveBeenCalledTimes(2);
    });
  });

  it('restores queued messages as pending bubbles on mount and flushes them', async () => {
    const saved = message({ id: 'm5', content: 'Sisa' });
    idb.getMeta.mockResolvedValue([
      { clientId: 'local-123', teamId: 't1', content: 'Sisa', refs: [], authorId: 'u1', authorName: 'Ana', createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
    api.sendMessage.mockResolvedValue(saved);
    api.listMessages
      .mockResolvedValueOnce({ messages: [], nextCursor: null })
      .mockResolvedValue({ messages: [saved], nextCursor: null });
    renderPanel();

    const bubble = await screen.findByText('Sisa');
    await waitFor(() => {
      expect(bubble.className).not.toContain('chat-msg-pending');
    });
    expect(api.sendMessage).toHaveBeenCalledWith('t1', 'Sisa', []);
    expect(idb.putMeta).toHaveBeenCalledWith('chatQueue:t1', []);
  });

  it('shows mention suggestions when typing an @ query', async () => {
    api.search.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Demo',
        hits: [
          { entity: 'tasks', entityId: 't1', title: 'Build login', field: 'title', snippet: '', score: 1 },
        ],
      },
    ]);
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: '@ta' } });

    expect(await screen.findByRole('option', { name: /Build login/ })).toBeTruthy();
    expect(screen.getByText('Task')).toBeTruthy();
    expect(api.search).toHaveBeenCalledWith('ta', expect.anything(), 10);
  });

  it('shows a hint for short queries without searching', async () => {
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: '@t' } });

    expect(await screen.findByText(/keep typing/i)).toBeTruthy();
    expect(api.search).not.toHaveBeenCalled();
  });

  it('inserts the selected mention with Enter after ArrowDown', async () => {
    api.search.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Demo',
        hits: [
          { entity: 'tasks', entityId: 't1', title: 'Build login', field: 'title', snippet: '', score: 1 },
        ],
      },
    ]);
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: '@ta' } });
    await screen.findByRole('option', { name: /Build login/ });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect((input as HTMLTextAreaElement).value).toBe('@[Build login](tasks:t1) ');
    expect(screen.queryByRole('listbox', { name: 'Mention search' })).toBeNull();
  });

  it('inserts the mention when an option is clicked', async () => {
    api.search.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Demo',
        hits: [
          { entity: 'issues', entityId: 'i9', title: 'Flaky test', field: 'title', snippet: '', score: 1 },
        ],
      },
    ]);
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'lihat @fla' } });
    fireEvent.click(await screen.findByRole('option', { name: /Flaky test/ }));

    expect((input as HTMLTextAreaElement).value).toBe('lihat @[Flaky test](issues:i9) ');
  });

  it('sends the mention token and its refs, then resets the refs', async () => {
    const saved = message({ id: 'm2', content: 'Cek @[Build login](tasks:t1) yuk' });
    api.sendMessage.mockResolvedValue(saved);
    api.search.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Demo',
        hits: [
          { entity: 'tasks', entityId: 't1', title: 'Build login', field: 'title', snippet: '', score: 1 },
        ],
      },
    ]);
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: '@bu' } });
    fireEvent.click(await screen.findByRole('option', { name: /Build login/ }));
    fireEvent.change(input, { target: { value: 'Cek @[Build login](tasks:t1) yuk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('button', { name: '#t1' })).toBeTruthy();
    expect(api.sendMessage).toHaveBeenCalledWith('t1', 'Cek @[Build login](tasks:t1) yuk', [
      { entity: 'tasks', entityId: 't1' },
    ]);

    fireEvent.change(input, { target: { value: 'lagi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledTimes(2);
    });
    expect(api.sendMessage).toHaveBeenLastCalledWith('t1', 'lagi', []);
  });

  it('closes the mention popup with Escape without inserting', async () => {
    api.search.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Demo',
        hits: [
          { entity: 'tasks', entityId: 't1', title: 'Build login', field: 'title', snippet: '', score: 1 },
        ],
      },
    ]);
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: '@ta' } });
    await screen.findByRole('option', { name: /Build login/ });

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox', { name: 'Mention search' })).toBeNull();
    expect((input as HTMLTextAreaElement).value).toBe('@ta');
  });

  it('deduplicates refs for repeated inserts of the same entity', async () => {
    const saved = message({ id: 'm2', content: 'x' });
    api.sendMessage.mockResolvedValue(saved);
    api.search.mockResolvedValue([
      {
        projectId: 'p1',
        projectName: 'Demo',
        hits: [
          { entity: 'tasks', entityId: 't1', title: 'Build login', field: 'title', snippet: '', score: 1 },
        ],
      },
    ]);
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: '@bu' } });
    fireEvent.click(await screen.findByRole('option', { name: /Build login/ }));
    fireEvent.change(input, { target: { value: '@[Build login](tasks:t1) @bu' } });
    fireEvent.click(await screen.findByRole('option', { name: /Build login/ }));
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(api.sendMessage).toHaveBeenCalledTimes(1);
    });
    expect(api.sendMessage).toHaveBeenCalledWith('t1', 'x', [
      { entity: 'tasks', entityId: 't1' },
    ]);
  });

  it('renders refs in messages as chips with resolved titles', async () => {
    api.listMessages.mockResolvedValue({
      messages: [
        message({
          id: 'm5',
          content: 'Cek @[Build login](tasks:t1) yuk',
        }),
      ],
      nextCursor: null,
    });
    api.resolveChatRefs.mockResolvedValue([{ entity: 'tasks', entityId: 't1', projectId: 'p1', title: 'Build login' }]);
    renderPanel();

    const chip = await screen.findByRole('button', { name: 'Build login' });
    expect(chip.className).toContain('chat-chip');
    expect(chip.hasAttribute('disabled')).toBe(false);
    expect(api.resolveChatRefs).toHaveBeenCalledWith('t1', [
      { entity: 'tasks', entityId: 't1' },
    ]);
    expect(screen.getByText(/Cek/)).toBeTruthy();
    expect(screen.getByText(/yuk/)).toBeTruthy();
  });

  it('navigates to the linked entity when a chip is clicked', async () => {
    api.listMessages.mockResolvedValue({
      messages: [message({ id: 'm6', content: 'lihat @[Build login](tasks:t1)' })],
      nextCursor: null,
    });
    api.resolveChatRefs.mockResolvedValue([{ entity: 'tasks', entityId: 't1', projectId: 'p1', title: 'Build login' }]);
    renderPanel(['/teams/t1']);

    const chip = await screen.findByRole('button', { name: 'Build login' });
    fireEvent.click(chip);
    expect(screen.getByTestId('loc').textContent).toBe('/project/p1?tab=board&entity=tasks&id=t1');
  });

  it('renders a disabled fallback chip for unresolved refs', async () => {
    api.listMessages.mockResolvedValue({
      messages: [message({ id: 'm7', content: 'link @[Ghost](tasks:11111111-1111-4111-8111-111111111111)' })],
      nextCursor: null,
    });
    renderPanel();

    const chip = await screen.findByRole('button', { name: '#111111' });
    expect(chip.hasAttribute('disabled')).toBe(true);
  });

  it('resolves refs from multiple messages in one batch', async () => {
    api.listMessages.mockResolvedValue({
      messages: [
        message({ id: 'm8', content: 'a @[Build login](tasks:t1)' }),
        message({ id: 'm9', content: 'b @[Flaky test](issues:i9)' }),
      ],
      nextCursor: null,
    });
    api.resolveChatRefs.mockResolvedValue([]);
    renderPanel();

    await waitFor(() => {
      expect(api.resolveChatRefs).toHaveBeenCalledTimes(1);
    });
    expect(api.resolveChatRefs).toHaveBeenCalledWith('t1', [
      { entity: 'issues', entityId: 'i9' },
      { entity: 'tasks', entityId: 't1' },
    ]);
  });

  it('renders chips for messages from other members', async () => {
    api.listMessages.mockResolvedValue({
      messages: [
        message({
          id: 'm10',
          authorId: 'u2',
          authorName: 'Budi',
          content: 'lihat @[Build login](tasks:t1)',
        }),
      ],
      nextCursor: null,
    });
    api.resolveChatRefs.mockResolvedValue([{ entity: 'tasks', entityId: 't1', projectId: 'p1', title: 'Build login' }]);
    renderPanel();

    const chip = await screen.findByRole('button', { name: 'Build login' });
    expect(chip.hasAttribute('disabled')).toBe(false);
  });

  it('shows the chat list in ascending order (oldest first)', async () => {
    api.listMessages.mockResolvedValue({
      messages: [
        message({ id: 'm2', content: 'pesan baru' }),
        message({ id: 'm1', content: 'pesan lama' }),
      ],
      nextCursor: null,
    });
    renderPanel();
    expect(await screen.findByText('pesan lama')).toBeTruthy();

    const bubbles = document.querySelectorAll('.chat-msg');
    expect(bubbles.length).toBe(2);
    expect(bubbles[0]!.textContent).toContain('pesan lama');
    expect(bubbles[1]!.textContent).toContain('pesan baru');
  });

  it('prepends older messages at the top when scrolling up', async () => {
    const first = Array.from({ length: 30 }, (_, i) => message({ id: `p${i}`, content: `pesan ${i}` }));
    api.listMessages.mockResolvedValueOnce({ messages: first, nextCursor: 'c1' });
    api.listMessages.mockResolvedValueOnce({
      messages: [message({ id: 'old1', content: 'pesan lama' })],
      nextCursor: null,
    });
    renderPanel();
    expect(await screen.findByText('pesan 0')).toBeTruthy();

    observers[observers.length - 1]?.([{ isIntersecting: true }]);
    await screen.findByText('pesan lama');

    const bubbles = document.querySelectorAll('.chat-msg');
    expect(bubbles[0]!.textContent).toContain('pesan lama');
    expect(bubbles[30]!.textContent).toContain('pesan 0');
  });

  it('renders the full ref title in the chip without truncation', async () => {
    const title = 'Tugas berjudul sangat panjang sekali untuk menguji chip yang tidak boleh terpotong sampai ujung';
    api.listMessages.mockResolvedValue({
      messages: [message({ id: 'm11', content: `cek @[${title}](tasks:t1)` })],
      nextCursor: null,
    });
    api.resolveChatRefs.mockResolvedValue([{ entity: 'tasks', entityId: 't1', projectId: 'p1', title }]);
    renderPanel();

    const chip = await screen.findByRole('button', { name: title });
    expect(chip.textContent).toBe(title);
  });

  it('shows a single date divider for same-day messages', async () => {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    api.listMessages.mockResolvedValueOnce({
      messages: [
        message({ id: 'm1', content: 'satu', createdAt: new Date(noon.getTime() - 60_000).toISOString() }),
        message({ id: 'm2', content: 'dua', createdAt: noon.toISOString() }),
      ],
      nextCursor: null,
    });
    renderPanel();
    await screen.findByText('dua');
    expect(document.querySelectorAll('.chat-date-divider').length).toBe(1);
    expect(document.querySelector('.chat-date-divider')?.textContent).toContain('Today');
  });

  it('shows a date divider when the day changes between messages', async () => {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    const yesterday = new Date(noon);
    yesterday.setDate(yesterday.getDate() - 1);
    api.listMessages.mockResolvedValueOnce({
      messages: [
        message({ id: 'm2', content: 'hari ini', createdAt: noon.toISOString() }),
        message({ id: 'm1', content: 'kemarin', createdAt: yesterday.toISOString() }),
      ],
      nextCursor: null,
    });
    renderPanel();
    await screen.findByText('hari ini');
    const dividers = document.querySelectorAll('.chat-date-divider');
    expect(dividers.length).toBe(2);
    expect(dividers[0]?.textContent).toContain('Yesterday');
    expect(dividers[1]?.textContent).toContain('Today');
  });

  it('shows smart times for today, yesterday, and older messages', async () => {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    const yesterday = new Date(noon);
    yesterday.setDate(yesterday.getDate() - 1);
    const old = new Date(noon);
    old.setDate(old.getDate() - 5);
    const hhmm = new Date(noon).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    const timeOld = new Date(old).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    const timeYesterday = new Date(yesterday).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    api.listMessages.mockResolvedValueOnce({
      messages: [
        message({ id: 'm3', content: 'sekarang', createdAt: noon.toISOString() }),
        message({ id: 'm2', content: 'kemarin', createdAt: yesterday.toISOString() }),
        message({ id: 'm1', content: 'lama', createdAt: old.toISOString() }),
      ],
      nextCursor: null,
    });
    renderPanel();
    await screen.findByText('sekarang');
    const times = document.querySelectorAll('.chat-msg-time');
    expect(times[0]?.textContent).toBe(`${new Date(old.toISOString()).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} • ${timeOld}`);
    expect(times[1]?.textContent).toBe(`Yesterday • ${timeYesterday}`);
    expect(times[2]?.textContent).toBe(hhmm);
  });

  it('retries a failed message with the same content', async () => {
    api.sendMessage
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(message({ id: 'm9', content: 'Halo tim' }));
    renderPanel();
    const input = await screen.findByLabelText('Message');
    fireEvent.change(input, { target: { value: 'Halo tim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Halo tim');
    await waitFor(() => {
      const bubble = screen.getByText('Halo tim').closest('.chat-msg');
      expect(bubble?.className).toContain('chat-msg-failed');
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(2));
    expect(api.sendMessage).toHaveBeenLastCalledWith('t1', 'Halo tim', []);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull());
  });

  it('dismisses a failed message', async () => {
    api.sendMessage.mockRejectedValueOnce(new Error('boom'));
    renderPanel();
    const input = await screen.findByLabelText('Message');
    fireEvent.change(input, { target: { value: 'Gagal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Gagal');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('Gagal')).toBeNull());
  });

  it('shows the offline strip when messages are queued', async () => {
    idb.getMeta.mockImplementation((key: string) => {
      if (key === 'chatQueue:t1') {
        return Promise.resolve([
          { clientId: 'local-9', teamId: 't1', content: 'Sisa', refs: [], authorId: 'u1', authorName: 'Ana', createdAt: '2026-01-01T00:00:00.000Z' },
        ]);
      }
      return Promise.resolve(null);
    });
    api.sendMessage.mockRejectedValue(new ApiError(0, 'NETWORK', 'Cannot reach the server. Is it running?'));
    renderPanel();
    expect(await screen.findByText(/Waiting for connection/)).toBeTruthy();
  });

  it('shows the unread divider for messages newer than the last read time', async () => {
    idb.getMeta.mockImplementation((key: string) => {
      if (key === 'chatLastRead:t1') return Promise.resolve('2026-01-01T00:00:00.000Z');
      return Promise.resolve(null);
    });
    api.listMessages.mockResolvedValueOnce({
      messages: [message({ id: 'm1', content: 'baru', createdAt: '2026-01-02T00:00:00.000Z' })],
      nextCursor: null,
    });
    renderPanel();
    await screen.findByText('baru');
    expect(screen.getByText('New messages')).toBeTruthy();
    expect(document.querySelector('.chat-unread-divider')).toBeTruthy();
  });

  it('does not show the unread divider for the sender\'s own new message', async () => {
    idb.getMeta.mockImplementation((key: string) => {
      if (key === 'chatLastRead:t1') return Promise.resolve('2026-01-01T00:00:00.000Z');
      return Promise.resolve(null);
    });
    api.listMessages.mockResolvedValueOnce({ messages: [], nextCursor: null });
    const saved = message({ id: 'm-sent', content: 'Halo tim', createdAt: '2030-01-01T00:00:00.000Z' });
    api.sendMessage.mockResolvedValueOnce(saved);
    renderPanel();
    await screen.findByText('No messages yet');
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Halo tim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Halo tim');
    expect(screen.queryByText('New messages')).toBeNull();
  });

  it('does not flag messages arriving while the drawer is open', async () => {
    idb.getMeta.mockImplementation((key: string) => {
      if (key === 'chatLastRead:t1') return Promise.resolve('2026-01-01T00:00:00.000Z');
      return Promise.resolve(null);
    });
    api.listMessages.mockResolvedValueOnce({
      messages: [message({ id: 'm1', content: 'lama', createdAt: '2026-01-02T00:00:00.000Z' })],
      nextCursor: null,
    });
    renderPanel();
    await screen.findByText('lama');
    expect(screen.getByText('New messages')).toBeTruthy();
    sockets[0]!.onMessageNew?.('t1', message({ id: 'm-live', authorId: 'u2', authorName: 'Budi', content: 'baru live', createdAt: new Date().toISOString() }));
    await screen.findByText('baru live');
    expect(document.querySelectorAll('.chat-unread-divider').length).toBe(1);
  });

  it('shows the scroll-to-bottom button when scrolled up', async () => {
    api.listMessages.mockResolvedValueOnce({
      messages: Array.from({ length: 30 }, (_, i) => message({ id: `m${i}`, content: `pesan ${i}` })),
      nextCursor: null,
    });
    renderPanel();
    await screen.findByText('pesan 0');
    expect(screen.queryByRole('button', { name: 'Scroll to bottom' })).toBeNull();
    const list = document.querySelector('.chat-list') as HTMLDivElement;
    Object.defineProperty(list, 'scrollHeight', { value: 1500 });
    Object.defineProperty(list, 'clientHeight', { value: 400 });
    list.scrollTop = 500;
    fireEvent.scroll(list);
    expect(screen.getByRole('button', { name: 'Scroll to bottom' })).toBeTruthy();
  });

  it('copies a message to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    api.listMessages.mockResolvedValueOnce({
      messages: [message({ id: 'm1', content: 'Hello world' })],
      nextCursor: null,
    });
    renderPanel();
    await screen.findByText('Hello world');
    fireEvent.click(screen.getByRole('button', { name: 'Copy message' }));
    expect(writeText).toHaveBeenCalledWith('Hello world');
  });

  it('does not duplicate a message when the websocket echo arrives before the POST resolves', async () => {
    const saved = message({ id: 'm9', content: 'Halo tim' });
    let resolvePost!: (m: ChatMessage) => void;
    api.sendMessage.mockReturnValue(new Promise((r) => { resolvePost = r; }));
    renderPanel();
    await screen.findByText('No messages yet');
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Halo tim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Halo tim');
    sockets[0]!.onMessageNew?.('t1', saved);
    await act(async () => { resolvePost(saved); });
    await waitFor(() => {
      expect(document.querySelectorAll('.chat-msg')).toHaveLength(1);
    });
    expect(screen.getByText('Halo tim').closest('.chat-msg')?.className).not.toContain('chat-msg-pending');
  });

  it('does not duplicate a message when the websocket echo arrives after the POST resolves', async () => {
    const saved = message({ id: 'm9', content: 'Halo tim' });
    api.sendMessage.mockResolvedValueOnce(saved);
    renderPanel();
    await screen.findByText('No messages yet');
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Halo tim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Halo tim');
    await waitFor(() => expect(document.querySelectorAll('.chat-msg')).toHaveLength(1));
    sockets[0]!.onMessageNew?.('t1', saved);
    expect(document.querySelectorAll('.chat-msg')).toHaveLength(1);
  });

  it('keeps the unread divider when a live message arrives while the drawer is open', async () => {
    idb.getMeta.mockImplementation((key: string) =>
      key === 'chatLastRead:t1'
        ? Promise.resolve('2026-01-01T00:00:00.000Z')
        : Promise.resolve(null),
    );
    api.listMessages.mockResolvedValue({
      messages: [message({ id: 'm1', content: 'lama', createdAt: '2026-01-02T00:00:00.000Z' })],
      nextCursor: null,
    });
    renderPanel();
    await screen.findByText('lama');
    expect(screen.getByText('New messages')).toBeTruthy();
    sockets[0]!.onMessageNew?.('t1', message({ id: 'm-live', authorId: 'u2', authorName: 'Budi', content: 'baru', createdAt: new Date().toISOString() }));
    await screen.findByText('baru');
    expect(document.querySelectorAll('.chat-unread-divider')).toHaveLength(1);
    const lastReadWrites = idb.putMeta.mock.calls.filter((c) => c[0] === 'chatLastRead:t1');
    expect(lastReadWrites).toHaveLength(0);
  });

  it('writes the read boundary when the drawer closes', async () => {
    idb.getMeta.mockImplementation((key: string) =>
      key === 'chatLastRead:t1'
        ? Promise.resolve('2026-01-01T00:00:00.000Z')
        : Promise.resolve(null),
    );
    api.listMessages.mockResolvedValue({
      messages: [message({ id: 'm1', content: 'lama', createdAt: '2026-01-02T00:00:00.000Z' })],
      nextCursor: null,
    });
    const { unmount } = renderPanel();
    await screen.findByText('lama');
    expect(screen.getByText('New messages')).toBeTruthy();
    unmount();
    const lastReadWrites = idb.putMeta.mock.calls.filter((c) => c[0] === 'chatLastRead:t1');
    expect(lastReadWrites).toHaveLength(1);
    expect(lastReadWrites[0]).toEqual(['chatLastRead:t1', '2026-01-02T00:00:00.000Z']);
  });

  it('shows the @ hint when the draft is empty and keeps mention search hints', async () => {
    renderPanel();
    await screen.findByText('No messages yet');
    expect(screen.getByText(/type @/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'halo' } });
    expect(screen.queryByText(/type @/i)).toBeNull();
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: '@' } });
    expect(screen.getByText(/keep typing/i)).toBeTruthy();
  });

  it('scrolls to the bottom after sending', async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      message({ id: `p${i}`, content: `pesan ${i}`, createdAt: `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z` }),
    );
    api.listMessages.mockResolvedValue({ messages: many, nextCursor: null });
    api.sendMessage.mockResolvedValueOnce(message({ id: 'saved1', content: 'Halo tim' }));
    renderPanel();
    await screen.findByText('pesan 0');
    const list = document.querySelector('.chat-list') as HTMLElement;
    Object.defineProperty(list, 'scrollHeight', { value: 1500, configurable: true });
    Object.defineProperty(list, 'clientHeight', { value: 400, configurable: true });
    list.scrollTop = 0;
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Halo tim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() => expect(list.scrollTop).toBe(1500));
  });
});


