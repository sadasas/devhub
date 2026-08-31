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
import { getErrorMessage } from '../../lib/errors';
import { useTranslation } from 'react-i18next';
import type { ChatMessage, ChatRef, ChatResolvedRef } from '../../lib/types';
import { buildMentionToken, parseChatRefs } from '../../lib/chat-tokens';
import { entityDeepLink } from '../../lib/deep-link';
import { getMeta, putMeta } from '../../lib/idb';
import { realtimeWsUrl, TeamChatSocket, type TeamChatSocketOptions } from '../../lib/realtime-client';
import { avatarColor, initialsOf } from '../../lib/avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { FE_LIMITS } from '../../lib/limits';

const PAGE_SIZE = 30;
const MENTION_DEBOUNCE_MS = 250;
const MENTION_RESULT_LIMIT = 10;
const GROUP_GAP_MS = 5 * 60_000;
const SCROLL_FAB_THRESHOLD = 400;

const ENTITY_LABEL_KEYS: Record<string, string> = {
  tasks: 'teams.chat.entity.tasks',
  issues: 'teams.chat.entity.issues',
  testCases: 'teams.chat.entity.testCases',
  decisions: 'teams.chat.entity.decisions',
  techEntries: 'teams.chat.entity.techEntries',
  apiEndpoints: 'teams.chat.entity.apiEndpoints',
  apiCollections: 'teams.chat.entity.apiCollections',
  milestones: 'teams.chat.entity.milestones',
  whiteboards: 'teams.chat.entity.whiteboards',
  tables: 'teams.chat.entity.tables',
  relations: 'teams.chat.entity.relations',
  schemaVersions: 'teams.chat.entity.schemaVersions',
};

const ENTITY_TINT: Record<string, string> = {
  tasks: 'var(--accent)',
  issues: 'var(--status-danger)',
  testCases: 'var(--status-warn)',
  decisions: 'var(--status-info)',
  techEntries: 'var(--method-patch)',
  apiEndpoints: 'var(--status-danger)',
  apiCollections: 'var(--status-warn)',
  milestones: 'var(--status-info)',
  whiteboards: 'var(--method-patch)',
  tables: 'var(--text-muted)',
  relations: 'var(--text-muted)',
  schemaVersions: 'var(--text-muted)',
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
  const { t } = useTranslation('account');
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nextCursorId, setNextCursorId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const [deleteFailedIds, setDeleteFailedIds] = useState<string[]>([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [lastReadAt, setLastReadAt] = useState<string | null>(null);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
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

  const dayLabel = useCallback((iso: string): string => {
    const d = new Date(iso);
    const today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
    if (diff <= 0) return t('teams.chat.today');
    if (diff === 1) return t('teams.chat.yesterday');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }, [t]);

  function formatChatTime(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    if (diff <= 0) return time;
    if (diff === 1) return `${t('teams.chat.yesterday')} • ${time}`;
    return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} • ${time}`;
  }

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
      setNextCursorId(res.nextCursorId ?? null);
      setLoadError(null);
      const openedAt = new Date().toISOString();
      const saved = await getMeta<string>(chatLastReadKey(teamId)).catch(() => null);
      if (typeof saved === 'string') setLastReadAt(saved);
      setOpenedAt(openedAt);
      requestAnimationFrame(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
      });
    } catch (err) {
      setLoadError(getErrorMessage(err, t('teams.chat.loadError')));
      setMessages([]);
    }
  }, [teamId, t]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  useEffect(() => {
    return () => {
      const newest = messagesRef.current.at(-1)?.createdAt;
      if (newest) void putMeta(chatLastReadKey(teamId), newest).catch(() => {});
    };
  }, [teamId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    try {
      const res = await api.listMessages(teamId, {
        limit: PAGE_SIZE,
        before: nextCursor,
        ...(nextCursorId ? { beforeId: nextCursorId } : {}),
      });
      const merged = [...[...res.messages].reverse(), ...messagesRef.current];
      messagesRef.current = merged;
      setMessages(merged);
      setNextCursor(res.nextCursor);
      setNextCursorId(res.nextCursorId ?? null);
    } catch {
      /* keep current list; retry on next sentinel hit */
    } finally {
      loadingMoreRef.current = false;
    }
  }, [teamId, nextCursor, nextCursorId]);

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
    const tempIdx = messagesRef.current.findIndex(
      (m) => m.id.startsWith('local-') && m.content === message.content && m.authorId === message.authorId,
    );
    if (tempIdx >= 0) {
      const merged = [...messagesRef.current];
      merged[tempIdx] = message;
      messagesRef.current = merged;
      setMessages(merged);
      return;
    }
    const merged = [...messagesRef.current, message];
    messagesRef.current = merged;
    setMessages(merged);
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (list && list.scrollHeight - list.scrollTop - list.clientHeight < 40) {
        const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (typeof list.scrollTo === 'function') list.scrollTo({ top: list.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
        else list.scrollTop = list.scrollHeight;
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
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (list) {
        const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (typeof list.scrollTo === 'function') list.scrollTo({ top: list.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
        else list.scrollTop = list.scrollHeight;
      }
    });
    try {
      const saved = await api.sendMessage(teamId, content, refs);
      const next = messagesRef.current.map((m) => (m.id === temp.id ? saved : m));
      messagesRef.current = next.filter(
        (m, i) => m.id !== saved.id || next.findIndex((x) => x.id === saved.id) === i,
      );
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
        setSendError(getErrorMessage(err, t('teams.chat.sendFailed')));
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
      setDeleteFailedIds((ids) => ids.filter((id) => id !== message.id));
    } catch {
      setDeleteFailedIds((ids) => (ids.includes(message.id) ? ids : [...ids, message.id]));
    }
  }

  function onDismissDeleteFailure(message: ChatMessage) {
    setDeleteFailedIds((ids) => ids.filter((id) => id !== message.id));
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
          title={
            resolved?.projectId
              ? t('teams.chat.chipOpen', { title })
              : t('teams.chat.chipNotShared', { title })
          }
          disabled={!resolved?.projectId}
          style={
            {
              color: tint,
              background: `color-mix(in srgb, ${tint} 12%, transparent)`,
              borderColor: `color-mix(in srgb, ${tint} 30%, transparent)`,
            } as React.CSSProperties
          }
          onClick={() => {
            if (!resolved?.projectId) return;
            navigate(entityDeepLink(resolved.projectId, entity as Parameters<typeof entityDeepLink>[1], entityId));
          }}
        >
          <EntityIcon size={12} weight="bold" aria-hidden="true" style={{ color: tint }} />
          <span className="chat-chip-label">{label}</span>
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
      if (
        !unreadPlaced &&
        lastReadAt &&
        openedAt &&
        new Date(m.createdAt) > new Date(lastReadAt) &&
        new Date(m.createdAt) <= new Date(openedAt)
      ) {
        out.push({ kind: 'unread' });
        unreadPlaced = true;
      }
      out.push({ kind: 'msg', m });
    }
    return out;
  }, [messages, lastReadAt, openedAt, dayLabel]);

return (
    <div className="chat-panel">
      <div className="chat-list" ref={listRef} role="log" aria-live="polite" aria-relevant="additions text" aria-label={t('teams.chat.listAria', { defaultValue: 'Team messages' })} aria-busy={messages === null}>
        <div className="chat-sentinel" ref={sentinelRef} />
        {messages === null ? (
          <>
            <span className="sr-only" role="status">{t('teams.chat.loading', { defaultValue: 'Loading messages' })}</span>
            <div className="chat-skeleton-row">
              <span className="chat-skeleton-avatar skeleton" />
              <span className="chat-skeleton-lines">
                <span className="skeleton" />
                <span className="skeleton" />
              </span>
            </div>
            <div className="chat-skeleton-row">
              <span className="chat-skeleton-avatar skeleton" />
              <span className="chat-skeleton-lines">
                <span className="skeleton" />
                <span className="skeleton" />
              </span>
            </div>
            <div className="chat-skeleton-row">
              <span className="chat-skeleton-avatar skeleton" />
              <span className="chat-skeleton-lines">
                <span className="skeleton" />
                <span className="skeleton" />
              </span>
            </div>
          </>
        ) : messages.length === 0 ? (
          <div className="page-empty">
            <EmptyState
              icon={<PaperPlaneTilt size={22} />}
              title={t('teams.chat.emptyTitle')}
              description={t('teams.chat.emptyDescription')}
            />
          </div>
        ) : (
          rows!.map((row: { kind: string; label?: string; m?: ChatMessage }) => {
            if (row.kind === 'divider') {
              return (
                <div key={row.label} className="chat-date-divider" role="separator" aria-label={row.label}>
                  {row.label}
                </div>
              );
            }
            if (row.kind === 'unread') {
              return (
                <div key="unread" className="chat-unread-divider" role="separator" aria-label={t('teams.chat.unreadDivider')}>
                  {t('teams.chat.unreadDivider')}
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
            const deleteFailed = deleteFailedIds.includes(m.id);
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
                      {initialsOf(m.authorName || t('teams.chat.formerMember'))}
                    </span>
                  ) : (
                    <span className="chat-rail-time">
                      {new Date(m.createdAt).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </span>
                  )}
                </div>
                <div className="chat-msg-body">
                  {isGroupStart && (
                    <div className="chat-msg-header">
                      <span className={own ? 'chat-author chat-author-own' : 'chat-author'}>
                        {m.authorName || t('teams.chat.formerMember')}
                      </span>
                      <span className="chat-msg-time">{formatChatTime(m.createdAt)}</span>
                      {pending && <ClockCounterClockwise size={10} aria-hidden="true" />}
                    </div>
                  )}
                  {!isGroupStart && pending && (
                    <div className="chat-msg-header">
                      <ClockCounterClockwise size={10} aria-hidden="true" />
                      <span className="chat-msg-time">{formatChatTime(m.createdAt)}</span>
                    </div>
                  )}
                  <div className="chat-msg-text">{renderContent(m.content)}</div>
                  {failed && (
                    <div className="chat-msg-actions-inline" role="alert" aria-live="assertive">
                      <Button variant="ghost" size="sm" onClick={() => void onRetry(m)}>
                        {t('common:action.retry')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDismiss(m)}>
                        {t('teams.chat.dismiss')}
                      </Button>
                    </div>
                  )}
                  {deleteFailed && (
                    <div className="chat-msg-actions-inline" role="alert">
                      {t('teams.chat.notDeleted')}{' '}
                      <Button variant="ghost" size="sm" onClick={() => void onDelete(m)}>
                        {t('common:action.retry')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDismissDeleteFailure(m)}>
                        {t('teams.chat.dismiss')}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="chat-msg-actions">
                  <button
                    type="button"
                    className="chat-msg-action"
                    aria-label={t('teams.chat.copyMessage')}
                    title={t('teams.chat.copyMessage')}
                    onClick={() => void onCopy(m)}
                  >
                    <Copy size={12} aria-hidden="true" />
                  </button>
                  {own && !pending && (
                    <button
                      type="button"
                      className="chat-msg-action"
                      aria-label={t('teams.chat.deleteMessage')}
                      title={t('teams.chat.deleteMessage')}
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
            aria-label={t('teams.chat.scrollToBottom')}
            title={t('teams.chat.scrollToBottom')}
            onClick={() => {
              const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
              if (typeof listRef.current?.scrollTo === 'function') listRef.current?.scrollTo({ top: listRef.current!.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
              else if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
            }}
          >
            <PaperPlaneTilt size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="chat-inline-feedback">
        {loadError && <InlineError>{loadError}</InlineError>}
        {sendError && <InlineError>{sendError}</InlineError>}
      </div>
      <div className="chat-composer">
        {queuedCount > 0 && (
          <div className="chat-offline-strip" role="status">
            <ClockCounterClockwise size={12} aria-hidden="true" />
            {t('teams.chat.queued', { count: queuedCount })}
          </div>
        )}
        {mention && (
          <div id="mention-listbox" className="mention-popup" role="listbox" aria-label={t('teams.chat.mentionSearchAria')}>
            {mention.query.length < 2 ? (
              <div className="mention-hint">{t('teams.chat.keepTyping')}</div>
            ) : mentionLoading ? (
              <div className="mention-hint">{t('teams.chat.searching')}</div>
            ) : mentionResults.length === 0 ? (
              <div className="mention-hint">{t('teams.chat.noMatches')}</div>
            ) : (
              mentionResults.map((hit, i) => {
                const entityKey = ENTITY_LABEL_KEYS[hit.entity];
                return (
                  <button
                    type="button"
                    id={`mention-opt-${i}`}
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
                      {entityKey ? t(entityKey) : hit.entity}
                    </span>
                    <span className="mention-option-title">{hit.title}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
        {!draft && (
          <span id="chat-composer-hint" className="chat-composer-hint">{t('teams.chat.composerTip')}</span>
        )}
        <div className="chat-composer-row">
        <textarea
          id="chat-input"
          className="chat-input"
          aria-label={t('teams.chat.messageAria')}
          aria-describedby={!draft ? 'chat-composer-hint' : undefined}
          aria-expanded={!!mention}
          aria-controls={mention ? 'mention-listbox' : undefined}
          aria-autocomplete="list"
          aria-activedescendant={mention && mentionResults[mentionIndex] ? `mention-opt-${mentionIndex}` : undefined}
          placeholder={t('teams.chat.placeholder')}
          title={t('teams.chat.enterToSend')}
          rows={1}
          maxLength={FE_LIMITS.CHAT_MESSAGE}
          value={draft}
          onInput={(ee) => {
            const ta = ee.currentTarget as HTMLTextAreaElement;
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
          }}
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
              if (e.key === 'Home') {
                e.preventDefault();
                setMentionIndex(0);
                return;
              }
              if (e.key === 'End') {
                e.preventDefault();
                setMentionIndex(mentionResults.length - 1);
                return;
              }
              if (e.key === 'Tab') {
                setMention(null);
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
          className="chat-send-btn"
          aria-label={t('teams.chat.sendAria')}
          loading={sending}
          disabled={!draft.trim()}
          onClick={() => void onSend()}
        >
          <PaperPlaneTilt size={14} aria-hidden="true" />
        </Button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: draft.length > Math.floor(FE_LIMITS.CHAT_MESSAGE * 0.9) ? 'var(--status-danger)' : draft.length > Math.floor(FE_LIMITS.CHAT_MESSAGE * 0.8) ? 'var(--status-warn)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{draft.length.toLocaleString()} / {FE_LIMITS.CHAT_MESSAGE.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
