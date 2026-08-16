import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Bug,
  ChalkboardSimple,
  CheckSquare,
  ClockCounterClockwise,
  Columns,
  Copy,
  FolderSimple,
  Graph,
  ListChecks,
  PaperPlaneTilt,
  Plugs,
  Rocket,
  Scales,
  Stack,
  Trash,
} from '@phosphor-icons/react';
import { ApiError, api, type SearchHit } from '../../lib/api';
import type { ChatMessage, ChatRef, ChatResolvedRef } from '../../lib/types';
import { buildMentionToken, parseChatRefs } from '../../lib/chat-tokens';
import { entityDeepLink } from '../../lib/deep-link';
import { getMeta, putMeta } from '../../lib/idb';
import { realtimeWsUrl, TeamChatSocket, type TeamChatSocketOptions } from '../../lib/realtime-client';
import { avatarColor, initialsOf } from '../../lib/avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';

const PAGE_SIZE = 30;
const MENTION_DEBOUNCE_MS = 250;
const MENTION_RESULT_LIMIT = 10;
const GROUP_GAP_MS = 5 * 60_000;
const SCROLL_FAB_THRESHOLD = 400;

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

const ENTITY_TINT: Record<string, string> = {
  tasks: '#34c38e',
  issues: '#f4706d',
  testCases: '#e8b955',
  decisions: '#6ea8fe',
  techEntries: '#2dd4bf',
  apiEndpoints: '#f4706d',
  apiCollections: '#e8b955',
  milestones: '#6ea8fe',
  whiteboards: '#2dd4bf',
  tables: '#a1a1aa',
  relations: '#a1a1aa',
  schemaVersions: '#a1a1aa',
};

const ENTITY_ICONS: Record<string, typeof CheckSquare> = {
  tasks: CheckSquare,
  issues: Bug,
  testCases: ListChecks,
  decisions: Scales,
  techEntries: Stack,
  apiEndpoints: Plugs,
  apiCollections: FolderSimple,
  milestones: Rocket,
  whiteboards: ChalkboardSimple,
  tables: Columns,
  relations: Graph,
  schemaVersions: Graph,
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatChatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff <= 0) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function chatLastReadKey(teamId: string): string {
  return `chatLastRead:${teamId}`;
}

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
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [showFab, setShowFab] = useState(false);

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

  const navigate = useNavigate();
  const resolvedRefsRef = useRef<Map<string, ChatResolvedRef>>(new Map());
  const [resolvedRefs, setResolvedRefs] = useState<Map<string, ChatResolvedRef>>(
    () => new Map(),
  );

  const resolveRefsFor = useCallback(async (list: ChatMessage[]) => {
    const missing = new Map<string, ChatRef>();
    for (const m of list) {
      for (const ref of parseChatRefs(m.content)) {
        const key = `${ref.entity}:${ref.entityId}`;
        if (!resolvedRefsRef.current.has(key)) missing.set(key, ref);
      }
    }
    if (missing.size === 0) return;
    const refs = Array.from(missing.values());
    try {
      const resolved = await api.resolveChatRefs(teamId, refs);
      const next = new Map(resolvedRefsRef.current);
      for (const r of resolved) next.set(`${r.entity}:${r.entityId}`, r);
      resolvedRefsRef.current = next;
      setResolvedRefs(next);
    } catch {
      /* chips fall back to #shortId labels */
    }
  }, [teamId]);

  useEffect(() => {
    if (!messages) return;
    void resolveRefsFor(messages);
  }, [messages, resolveRefsFor]);

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
      messagesRef.current = [...[...res.messages].reverse(), ...restored];
      setMessages(messagesRef.current);
      setNextCursor(res.nextCursor);
      setLoadError(null);
      const saved = await getMeta<string>(chatLastReadKey(teamId)).catch(() => null);
      if (typeof saved === 'string') setLastReadAt(saved);
      void putMeta(chatLastReadKey(teamId), new Date().toISOString()).catch(() => {});
      requestAnimationFrame(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
      });
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
      const merged = [...[...res.messages].reverse(), ...messagesRef.current];
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

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => {
      setShowFab(list.scrollHeight - list.scrollTop - list.clientHeight > SCROLL_FAB_THRESHOLD);
    };
    onScroll();
    list.addEventListener('scroll', onScroll);
    return () => list.removeEventListener('scroll', onScroll);
  }, [messages]);

  const onMessageNew = useCallback((_teamId: string, message: ChatMessage) => {
    if (messagesRef.current.some((m) => m.id === message.id)) return;
    const merged = [...messagesRef.current, message];
    messagesRef.current = merged;
    setMessages(merged);
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (list && list.scrollHeight - list.scrollTop - list.clientHeight < 40) {
        list.scrollTop = list.scrollHeight;
      }
    });
  }, []);

  const onMessageSent = useCallback((_teamId: string, message: ChatMessage) => {
    messagesRef.current = messagesRef.current.map((m) => (m.id.startsWith('local-') ? message : m));
    setMessages(messagesRef.current);
  }, []);

  const saveChatQueue = useCallback(() => {
    setQueuedCount(queuedRef.current.length);
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
      setQueuedCount(queue.length);
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
        setFailedIds((ids) => [...ids, temp.id]);
        setSendError(err instanceof ApiError ? err.message : 'Failed to send message');
      }
    } finally {
      setSending(false);
    }
  }

  async function onRetry(message: ChatMessage) {
    if (sending) return;
    setSending(true);
    try {
      const saved = await api.sendMessage(teamId, message.content, message.refs);
      messagesRef.current = messagesRef.current.map((m) => (m.id === message.id ? saved : m));
      setMessages(messagesRef.current);
      setFailedIds((ids) => ids.filter((id) => id !== message.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        queuedRef.current = [
          ...queuedRef.current,
          {
            clientId: message.id,
            teamId,
            content: message.content,
            refs: message.refs,
            authorId: message.authorId ?? '',
            authorName: message.authorName,
            createdAt: message.createdAt,
          },
        ];
        saveChatQueue();
        setFailedIds((ids) => ids.filter((id) => id !== message.id));
      }
    } finally {
      setSending(false);
    }
  }

  function onDismiss(message: ChatMessage) {
    messagesRef.current = messagesRef.current.filter((m) => m.id !== message.id);
    setMessages(messagesRef.current);
    setFailedIds((ids) => ids.filter((id) => id !== message.id));
  }

  async function onCopy(message: ChatMessage) {
    try {
      await navigator.clipboard?.writeText(message.content);
    } catch {
      /* clipboard best-effort */
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

  function renderContent(content: string) {
    const parts = content.split(/(@\[[^\]]+\]\([^:]+:[^)]+\))/);
    return parts.map((part, i) => {
      const match = part.match(/^@\[([^\]]+)\]\(([^:]+):([^)]+)\)$/);
      if (!match) return part;
      const title = match[1] ?? '';
      const entity = match[2] ?? '';
      const entityId = match[3] ?? '';
      const key = `${entity}:${entityId}`;
      const resolved = resolvedRefs.get(key);
      const label = resolved?.title ?? `#${entityId.slice(0, 6)}`;
      const EntityIcon = ENTITY_ICONS[entity] ?? CheckSquare;
      const tint = ENTITY_TINT[entity] ?? '#a1a1aa';
      return (
        <button
          type="button"
          key={i}
          className="chat-chip"
          title={resolved?.projectId ? `${title} — open in project` : `${title} — not shared`}
          disabled={!resolved?.projectId}
          onClick={() => {
            if (!resolved?.projectId) return;
            navigate(entityDeepLink(resolved.projectId, entity as Parameters<typeof entityDeepLink>[1], entityId));
          }}
        >
          <EntityIcon size={10} weight="bold" aria-hidden="true" style={{ color: tint }} />
          {label}
        </button>
      );
    });
  }

  const rows = useMemo(() => {
    if (!messages) return null;
    const out: Array<{ kind: 'divider'; label: string } | { kind: 'unread' } | { kind: 'msg'; m: ChatMessage }> = [];
    let prevDate = '';
    let unreadPlaced = false;
    for (const m of messages) {
      const date = dayLabel(m.createdAt);
      if (date !== prevDate) {
        out.push({ kind: 'divider', label: date });
        prevDate = date;
      }
      if (!unreadPlaced && lastReadAt && new Date(m.createdAt) > new Date(lastReadAt)) {
        out.push({ kind: 'unread' });
        unreadPlaced = true;
      }
      out.push({ kind: 'msg', m });
    }
    return out;
  }, [messages, lastReadAt]);

return (
    <div className="chat-panel">
      <div className="chat-list" ref={listRef}>
        <div className="chat-sentinel" ref={sentinelRef} />
        {messages === null ? (
          <>
            <div className="chat-skeleton-row">
              <span className="chat-skeleton-avatar" />
              <span className="chat-skeleton-lines">
                <span />
                <span />
              </span>
            </div>
            <div className="chat-skeleton-row">
              <span className="chat-skeleton-avatar" />
              <span className="chat-skeleton-lines">
                <span />
                <span />
              </span>
            </div>
            <div className="chat-skeleton-row">
              <span className="chat-skeleton-avatar" />
              <span className="chat-skeleton-lines">
                <span />
                <span />
              </span>
            </div>
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
          rows!.map((row: { kind: string; label?: string; m?: ChatMessage }) => {
            if (row.kind === 'divider') {
              return (
                <div key={row.label} className="chat-date-divider" role="separator">
                  {row.label}
                </div>
              );
            }
            if (row.kind === 'unread') {
              return (
                <div key="unread" className="chat-unread-divider" role="separator">
                  New messages
                </div>
              );
            }
            const m = row.m as ChatMessage;
            const idx = messages.findIndex((x) => x.id === m.id);
            const prev = idx > 0 ? messages[idx - 1] : undefined;
            const isGroupStart =
              !prev ||
              prev.authorId !== m.authorId ||
              new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > GROUP_GAP_MS;
            const own = m.authorId === userId;
            const pending = m.id.startsWith('local-');
            const failed = failedIds.includes(m.id);
            const color = avatarColor(m.authorId ?? '');
            return (
              <div
                key={m.id}
                className={`chat-msg${own ? ' chat-msg-own' : ''}${pending ? ' chat-msg-pending' : ''}${failed ? ' chat-msg-failed' : ''}`}
              >
                <div className="chat-rail">
                  {isGroupStart ? (
                    <span
                      className="chat-avatar"
                      style={{
                        background: `color-mix(in srgb, ${color} 18%, transparent)`,
                        color,
                      }}
                      aria-hidden="true"
                    >
                      {initialsOf(m.authorName || 'Former member')}
                    </span>
                  ) : (
                    <span className="chat-rail-time">
                      {new Date(m.createdAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <div className="chat-msg-body">
                  {isGroupStart && (
                    <div className="chat-msg-header">
                      <span className={own ? 'chat-author chat-author-own' : 'chat-author'}>
                        {m.authorName || 'Former member'}
                      </span>
                      {pending && <ClockCounterClockwise size={10} aria-hidden="true" />}
                      <span className="chat-msg-time">{formatChatTime(m.createdAt)}</span>
                    </div>
                  )}
                  <div className="chat-msg-text">{renderContent(m.content)}</div>
                  {failed && (
                    <div className="chat-msg-actions-inline">
                      <Button variant="ghost" size="sm" onClick={() => void onRetry(m)}>
                        Retry
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDismiss(m)}>
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
                <div className="chat-msg-actions">
                  <button
                    type="button"
                    className="chat-msg-action"
                    aria-label="Copy message"
                    title="Copy message"
                    onClick={() => void onCopy(m)}
                  >
                    <Copy size={12} aria-hidden="true" />
                  </button>
                  {own && !pending && (
                    <button
                      type="button"
                      className="chat-msg-action"
                      aria-label="Delete message"
                      title="Delete message"
                      onClick={() => void onDelete(m)}
                    >
                      <Trash size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        {showFab && messages && messages.length > 0 && (
          <button
            type="button"
            className="chat-scroll-fab"
            aria-label="Scroll to bottom"
            title="Scroll to bottom"
            onClick={() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })}
          >
            <PaperPlaneTilt size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {loadError && <InlineError>{loadError}</InlineError>}
      {sendError && <InlineError>{sendError}</InlineError>}
      <div className="chat-composer">
        {queuedCount > 0 && (
          <div className="chat-offline-strip" role="status">
            <ClockCounterClockwise size={12} aria-hidden="true" />
            Waiting for connection — {queuedCount} message{queuedCount === 1 ? '' : 's'} queued
          </div>
        )}
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
                  <span
                    className="mention-entity-badge"
                    style={{
                      background: `color-mix(in srgb, ${ENTITY_TINT[hit.entity] ?? '#a1a1aa'} 18%, transparent)`,
                      color: ENTITY_TINT[hit.entity] ?? '#a1a1aa',
                    }}
                  >
                    {ENTITY_LABELS[hit.entity] ?? hit.entity}
                  </span>
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
          title="Enter to send · Shift+Enter for new line"
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
