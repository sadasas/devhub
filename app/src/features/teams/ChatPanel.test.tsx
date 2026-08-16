import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ChatMessage } from '../../lib/types';
import type { TeamChatSocketOptions } from '../../lib/realtime-client';
import { ChatPanel } from './ChatPanel';

const api = vi.hoisted(() => ({
  listMessages: vi.fn(),
  sendMessage: vi.fn(),
  deleteMessage: vi.fn(),
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

function renderPanel() {
  return render(<ChatPanel teamId="t1" userId="u1" userDisplayName="Ana" />);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.listMessages.mockReset().mockResolvedValue({ messages: [], nextCursor: null });
  api.sendMessage.mockReset();
  api.deleteMessage.mockReset();
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
});


