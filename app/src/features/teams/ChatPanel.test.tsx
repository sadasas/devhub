import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('removes the pending bubble when sending fails', async () => {
    api.sendMessage.mockRejectedValue(new Error('boom'));
    renderPanel();
    await screen.findByText('No messages yet');

    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'Gagal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(screen.queryByText('Gagal')).toBeNull();
    });
    expect(screen.getByText(/failed to send message/i)).toBeTruthy();
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
    expect(idb.putMeta).toHaveBeenLastCalledWith('chatQueue:t1', []);
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

    expect(await screen.findByText('Type at least 2 characters')).toBeTruthy();
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
      { entity: 'tasks', entityId: 't1' },
      { entity: 'issues', entityId: 'i9' },
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
});


