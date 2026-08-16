import { useCallback, useEffect, useRef, useState } from 'react';
import { PaperPlaneTilt, Trash } from '@phosphor-icons/react';
import { ApiError, api, type SearchHit } from '../../lib/api';
import type { ChatMessage, ChatRef } from '../../lib/types';
import { buildMentionToken } from '../../lib/chat-tokens';
import { getMeta, putMeta } from '../../lib/idb';
import { realtimeWsUrl, TeamChatSocket, type TeamChatSocketOptions } from '../../lib/realtime-client';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';

const PAGE_SIZE = 30;
const MENTION_DEBOUNCE_MS = 250;
const MENTION_RESULT_LIMIT = 10;

const ENTITY_LABELS: Record<string, string> = {
  tasks: 'Task',
  issues: 'Issue',
  testCases: 'Test',
  decisions: 'Decision',
  techEntries: 'Tech',
  apiEndpoints: 'Endpoint',
  apiCollections: 'Collection',
  milestones: 'Milestone',
  whiteboards: 'Board',
  tables: 'Table',
  relations: 'Relation',
  schemaVersions: 'Schema',
};

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
  const refsRef = useRef<ChatRef[]>([]);

  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionResults, setMentionResults] = useState<SearchHit[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);

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

  useEffect(() => {
    if (!mention || mention.query.length < 2) {
      setMentionResults([]);
      setMentionLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setMentionLoading(true);
      api
        .search(mention.query, controller.signal, MENTION_RESULT_LIMIT)
        .then((res) => {
          const hits = res.flatMap((p) => p.hits);
          setMentionResults(hits.slice(0, MENTION_RESULT_LIMIT));
        })
        .catch(() => {
          if (!controller.signal.aborted) setMentionResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setMentionLoading(false);
        });
    }, MENTION_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mention]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionResults]);

  function insertMention(hit: SearchHit) {
    if (!mention) return;
    const token = buildMentionToken(hit.title, hit.entity, hit.entityId);
    const newDraft =
      draft.slice(0, mention.start) +
      token +
      ' ' +
      draft.slice(mention.start + mention.query.length + 1);
    setDraft(newDraft);
    setMention(null);
    setMentionResults([]);
    setMentionIndex(0);
    if (!refsRef.current.some((r) => r.entity === hit.entity && r.entityId === hit.entityId)) {
      refsRef.current = [...refsRef.current, { entity: hit.entity, entityId: hit.entityId }];
    }
  }

async function onSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError(null);
    const refs = refsRef.current;
    const temp: ChatMessage = {
      id: `local-${Date.now()}`,
      teamId,
      authorId: userId,
      authorName: userDisplayName,
      content,
      refs,
      createdAt: new Date().toISOString(),
    };
    messagesRef.current = [...messagesRef.current, temp];
    setMessages(messagesRef.current);
    setDraft('');
    refsRef.current = [];
    try {
      const saved = await api.sendMessage(teamId, content, refs);
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
            refs,
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
        {mention && (
          <div className="mention-popup" role="listbox" aria-label="Mention search">
            {mention.query.length < 2 ? (
              <div className="mention-hint">Type at least 2 characters</div>
            ) : mentionLoading ? (
              <div className="mention-hint">Searching…</div>
            ) : mentionResults.length === 0 ? (
              <div className="mention-hint">No matches</div>
            ) : (
              mentionResults.map((hit, i) => (
                <button
                  type="button"
                  key={`${hit.entity}:${hit.entityId}`}
                  className={`mention-option${i === mentionIndex ? ' mention-option-active' : ''}`}
                  role="option"
                  aria-selected={i === mentionIndex}
                  onMouseEnter={() => setMentionIndex(i)}
                  onClick={() => insertMention(hit)}
                >
                  <span className="mention-entity-badge">{ENTITY_LABELS[hit.entity] ?? hit.entity}</span>
                  <span className="mention-option-title">{hit.title}</span>
                </button>
              ))
            )}
          </div>
        )}
        <textarea
          className="chat-input"
          aria-label="Message"
          placeholder="Type a message…"
          rows={1}
          value={draft}
          onChange={(e) => {
            const value = e.target.value;
            setDraft(value);
            const match = value.match(/(?:^|\s)(@[^\s@]*)$/);
            if (match) {
              setMention({ start: match.index! + match[0].indexOf('@'), query: match[1]?.slice(1) ?? '' });
            } else {
              setMention(null);
            }
          }}
          onKeyDown={(e) => {
            if (mention) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex((i) => Math.min(i + 1, mentionResults.length - 1));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                const hit = mentionResults[mentionIndex];
                if (hit) {
                  e.preventDefault();
                  insertMention(hit);
                  return;
                }
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setMention(null);
                return;
              }
            }
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
