import { useEffect, useRef, useState } from 'react';
import { CaretDown, Users } from '@phosphor-icons/react';
import { api, type ActivityEntry } from '../lib/api';
import { formatRelative } from '../lib/utils';
import { useProject } from '../state/project-context';
import type { ActivityNew } from '../lib/realtime-client';
import { InlineError } from './InlineError';
import { Skeleton } from './Skeleton';

const LISTBOX_ID = 'presence-listbox';
const MAX_USERS = 5;
const ACTIVITY_LIMIT = 5;

interface UserActivity {
  items: ActivityEntry[] | null;
  error: string | null;
}

function ActionVerb({ action }: { action: ActivityEntry['action'] }) {
  if (action === 'created') return <span className="activity-verb activity-created">created</span>;
  if (action === 'deleted') return <span className="activity-verb activity-deleted">deleted</span>;
  return <span className="activity-verb activity-updated">updated</span>;
}

export function PresenceChip() {
  const { presence, projectId, subscribeActivity } = useProject();
  const [open, setOpen] = useState(false);
  const [byUser, setByUser] = useState<Record<string, UserActivity>>({});
  const wrapRef = useRef<HTMLSpanElement>(null);
  const loadedRef = useRef<Set<string>>(new Set());
  const displayedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) loadedRef.current.clear();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const users = presence.slice(0, MAX_USERS);
    displayedRef.current = new Set(users.map((u) => u.userId));
    setByUser((prev) => {
      const next = { ...prev };
      for (const u of users) {
        if (!next[u.userId]) next[u.userId] = { items: null, error: null };
      }
      return next;
    });
    for (const u of users) {
      if (loadedRef.current.has(u.userId)) continue;
      loadedRef.current.add(u.userId);
      api
        .fetchActivity(projectId, { authorId: u.userId, limit: ACTIVITY_LIMIT })
        .then((rows) => {
          if (!cancelled) setByUser((p) => ({ ...p, [u.userId]: { items: rows, error: null } }));
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setByUser((p) => ({
              ...p,
              [u.userId]: {
                items: p[u.userId]?.items ?? [],
                error: err instanceof Error ? err.message : 'Failed to load activity',
              },
            }));
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [open, projectId, presence]);

  useEffect(() => {
    const unsub = subscribeActivity((msg: ActivityNew) => {
      const authorId = msg.entry.authorId;
      if (!authorId || !displayedRef.current.has(authorId)) return;
      setByUser((prev) => {
        const cur = prev[authorId];
        if (!cur) return prev;
        const items = cur.items ?? [];
        const idx = items.findIndex((it) => it.id === msg.entry.id);
        const next =
          idx === -1
            ? [msg.entry, ...items].slice(0, ACTIVITY_LIMIT)
            : items.map((it) => (it.id === msg.entry.id ? msg.entry : it));
        return { ...prev, [authorId]: { ...cur, items: next } };
      });
    });
    return unsub;
  }, [subscribeActivity]);

  if (presence.length === 0) return null;

  return (
    <span className="presence-chip-wrap" ref={wrapRef}>
      <button
        type="button"
        className="badge badge-info presence-chip"
        data-testid="presence-chip"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={LISTBOX_ID}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="badge-dot" aria-hidden="true" />
        <Users size={11} aria-hidden="true" />
        {presence.length} online
        <CaretDown size={10} aria-hidden="true" />
      </button>
      {open && (
        <div className="presence-popover" id={LISTBOX_ID} role="listbox" aria-label="Online users">
          {presence.map((u) => {
            const act = byUser[u.userId];
            return (
              <div key={u.userId} className="presence-popover-user">
                <div className="presence-popover-item" role="option">
                  <span className="badge-dot" aria-hidden="true" />
                  {u.name || 'User'}
                </div>
                {act?.items === null ? (
                  <div className="presence-activity-loading" aria-busy="true">
                    <Skeleton style={{ width: '90%', height: '12px' }} />
                  </div>
                ) : act?.error ? (
                  <InlineError>{act.error}</InlineError>
                ) : act ? (
                  act.items.length === 0 ? (
                    <div className="presence-activity-empty">No activity yet</div>
                  ) : (
                    <ul className="presence-activity-list">
                      {act.items.map((entry) => (
                        <li key={entry.id} className="presence-activity-row">
                          <ActionVerb action={entry.action} />
                          <span className="presence-activity-summary">{entry.summary || '(untitled)'}</span>
                          <span className="presence-activity-time">{formatRelative(entry.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}