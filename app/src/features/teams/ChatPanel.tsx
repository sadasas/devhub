import { useCallback, useEffect, useRef, useState } from 'react';
import { PaperPlaneTilt, Trash } from '@phosphor-icons/react';
import { ApiError, api } from '../../lib/api';
import type { ChatMessage, ChatRef } from '../../lib/types';
import { getMeta, putMeta } from '../../lib/idb';
import { realtimeWsUrl, TeamChatSocket, type TeamChatSocketOptions } from '../../lib/realtime-client';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';

const PAGE_SIZE = 30;

interface QueuedChatMessage {
  clientId: string;
  teamId: string;
  content: string;
  refs: ChatRef[];
  authorId: string;
  authorName: string;
  createdAt: string;
}

interface ChatPanelProps {
  teamId: string;
  userId: string;
  userDisplayName: string;
}

function chatQueueKey(teamId: string): string {
  return `chatQueue:${teamId}`;
}

export function ChatPanel({ teamId, userId, userDisplayName }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const socketRef = useRef<TeamChatSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const queuedRef = useRef<QueuedChatMessage[]>([]);
  const flushingRef = useRef(false);

  const loadFirstPage = useCallback(async () => {
    try {
      const res = await api.listMessages(teamId, { limit: PAGE_SIZE });
      const restored: ChatMessage[] = queuedRef.current.map((q) => ({
        id: q.clientId,
        teamId: q.teamId,
        authorId: q.authorId,
        authorName: q.authorName,
        content: q.content,
        refs: q.refs,
        createdAt: q.createdAt,
      }));
      messagesRef.current = [...res.messages, ...restored];
      setMessages(messagesRef.current);
      setNextCursor(res.nextCursor);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load messages');
      setMessages([]);
    }
  }, [teamId]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      const res = await api.listMessages(teamId, { limit: PAGE_SIZE, before: nextCursor });
      const merged = [...messagesRef.current, ...res.messages];
      messagesRef.current = merged;
      setMessages(merged);
      setNextCursor(res.nextCursor);
    } catch {
      /* keep current list; retry on next sentinel hit */
    } finally {
      loadingMoreRef.current = false;
    }
  }, [teamId, nextCursor]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const onMessageNew = useCallback((_teamId: string, message: ChatMessage) => {
    if (messagesRef.current.some((m) => m.id === message.id)) return;
    const merged = [...messagesRef.current, message];
    messagesRef.current = merged;
    setMessages(merged);
  }, []);

  const onMessageSent = useCallback((_teamId: string, message: ChatMessage) => {
    messagesRef.current = messagesRef.current.map((m) => (m.id.startsWith('local-') ? message : m));
    setMessages(messagesRef.current);
  }, []);

  const saveChatQueue = useCallback(() => {
    void putMeta(chatQueueKey(teamId), queuedRef.current).catch(() => {});
  }, [teamId]);

  const flushQueue = useCallback(async () => {
    if (flushingRef.current || queuedRef.current.length === 0) return;
    flushingRef.current = true;
    try {
      for (const item of [...queuedRef.current]) {
        try {
          const saved = await api.sendMessage(item.teamId, item.content, item.refs);
          messagesRef.current = messagesRef.current.map((m) =>
            m.id === item.clientId ? saved : m,
          );
          setMessages(messagesRef.current);
          queuedRef.current = queuedRef.current.filter((q) => q.clientId !== item.clientId);
          saveChatQueue();
        } catch {
          break;
        }
      }
      if (queuedRef.current.length === 0) {
        await loadFirstPage();
      }
    } finally {
      flushingRef.current = false;
    }
  }, [loadFirstPage, saveChatQueue]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const queue = await getMeta<QueuedChatMessage[]>(chatQueueKey(teamId)).catch(() => null);
      if (cancelled || !queue || queue.length === 0) return;
      queuedRef.current = queue;
      const restored: ChatMessage[] = queue.map((q) => ({
        id: q.clientId,
        teamId: q.teamId,
        authorId: q.authorId,
        authorName: q.authorName,
        content: q.content,
        refs: q.refs,
        createdAt: q.createdAt,
      }));
      messagesRef.current = [...messagesRef.current, ...restored];
      setMessages(messagesRef.current);
      if (typeof navigator === 'undefined' || navigator.onLine) void flushQueue();
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, flushQueue]);

  useEffect(() => {
    const onOnline = () => {
      void flushQueue();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushQueue]);

  useEffect(() => {
    const opts: TeamChatSocketOptions = {
      wsUrl: realtimeWsUrl(),
      teamId,
      onJoinedTeam: () => {
        void flushQueue();
        void loadFirstPage();
      },
      onMessageNew,
      onMessageSent,
    };
    const socket = new TeamChatSocket(opts);
    socketRef.current = socket;
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [teamId, onMessageNew, onMessageSent, flushQueue, loadFirstPage]);

  async function onSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError(null);
    const temp: ChatMessage = {
      id: `local-${Date.now()}`,
      teamId,
      authorId: userId,
      authorName: userDisplayName,
      content,
      refs: [],
      createdAt: new Date().toISOString(),
    };
    messagesRef.current = [...messagesRef.current, temp];
    setMessages(messagesRef.current);
    setDraft('');
    try {
      const saved = await api.sendMessage(teamId, content, []);
      messagesRef.current = messagesRef.current.map((m) => (m.id === temp.id ? saved : m));
      setMessages(messagesRef.current);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        queuedRef.current = [
          ...queuedRef.current,
          {
            clientId: temp.id,
            teamId,
            content,
            refs: [],
            authorId: userId,
            authorName: userDisplayName,
            createdAt: temp.createdAt,
          },
        ];
        saveChatQueue();
      } else {
        messagesRef.current = messagesRef.current.filter((m) => m.id !== temp.id);
        setMessages(messagesRef.current);
        setSendError(err instanceof ApiError ? err.message : 'Failed to send message');
      }
    } finally {
      setSending(false);
    }
  }

  async function onDelete(message: ChatMessage) {
    try {
      await api.deleteMessage(teamId, message.id);
      messagesRef.current = messagesRef.current.filter((m) => m.id !== message.id);
      setMessages(messagesRef.current);
    } catch {
      /* keep message; user can retry later */
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-list" ref={listRef}>
        {messages === null ? (
          <>
            <Skeleton style={{ width: '100%', height: 56 }} />
            <Skeleton style={{ width: '100%', height: 56, marginTop: 8 }} />
          </>
        ) : messages.length === 0 ? (
          <div className="page-empty">
            <EmptyState
              icon={<PaperPlaneTilt size={22} />}
              title="No messages yet"
              description="Start the conversation — messages are shared with every team member."
            />
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`chat-msg${m.authorId === userId ? ' chat-msg-own' : ''}${m.id.startsWith('local-') ? ' chat-msg-pending' : ''}`}
            >
              <div className="chat-msg-header">
                <span>{m.authorName || 'Former member'}</span>
                <span className="chat-msg-time">{new Date(m.createdAt).toLocaleString()}</span>
                {m.authorId === userId && !m.id.startsWith('local-') && (
                  <button
                    type="button"
                    className="chat-msg-delete"
                    aria-label="Delete message"
                    title="Delete message"
                    onClick={() => void onDelete(m)}
                  >
                    <Trash size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="chat-msg-text">{m.content}</div>
            </div>
          ))
        )}
        <div className="chat-sentinel" ref={sentinelRef} />
      </div>
      {loadError && <InlineError>{loadError}</InlineError>}
      {sendError && <InlineError>{sendError}</InlineError>}
      <div className="chat-composer">
        <textarea
          className="chat-input"
          aria-label="Message"
          placeholder="Type a message…"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
        />
        <Button
          variant="primary"
          size="sm"
          aria-label="Send message"
          loading={sending}
          disabled={!draft.trim()}
          onClick={() => void onSend()}
        >
          <PaperPlaneTilt size={14} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
