import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ActivityEntry } from '../lib/api';
import {
  deletedDismissKey,
  readDismissedUntil,
  readUnreadMap,
  tabOfEntity,
  unreadStorageKey,
  writeDismissedUntil,
  writeUnreadMap,
} from '../lib/tab-unread';
import { useProject } from '../state/project-context';

const FETCH_PAGE_LIMIT = 100;
const MAX_DELETED = 20;

export interface TabUnreadResult {
  unread: Record<string, number>;
  unreadIds: Record<string, ReadonlySet<string>>;
  deleted: ActivityEntry[];
  dismissedUntil: string | null;
  dismissDeleted: () => void;
}

export function useTabUnread(
  projectId: string,
  userId: string,
  activeTab: string,
): TabUnreadResult {
  const storageKey = unreadStorageKey(projectId, userId);
  const dismissKey = deletedDismissKey(projectId);
  const lastReadRef = useRef<Record<string, string>>({});
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const prevTabRef = useRef(activeTab);

  const [unread, setUnread] = useState<Record<string, number>>({});
  const [unreadIds, setUnreadIds] = useState<Record<string, ReadonlySet<string>>>({});
  const [deleted, setDeleted] = useState<ActivityEntry[]>([]);
  const [dismissedUntil, setDismissedUntil] = useState<string | null>(() =>
    readDismissedUntil(dismissKey),
  );

  useEffect(() => {
    const map = readUnreadMap(storageKey);
    const prev = prevTabRef.current;
    prevTabRef.current = activeTab;
    if (prev && prev !== activeTab) {
      map[prev] = new Date().toISOString();
      writeUnreadMap(storageKey, map);
    }
    lastReadRef.current = map;
    let cancelled = false;
    void (async () => {
      try {
        const items = await api.fetchActivity(projectId, { limit: FETCH_PAGE_LIMIT });
        if (cancelled) return;
        const counts: Record<string, number> = {};
        const ids: Record<string, Set<string>> = {};
        const dels: ActivityEntry[] = [];
        for (const entry of items) {
          const tab = tabOfEntity(entry.entity);
          const last = map[tab];
          if (!last || new Date(entry.createdAt).getTime() > new Date(last).getTime()) {
            counts[tab] = (counts[tab] ?? 0) + 1;
            (ids[tab] ??= new Set()).add(entry.entityId);
          }
          if (entry.action === 'deleted') dels.push(entry);
        }
        delete counts[activeTab];
        setUnread(counts);
        setUnreadIds(Object.fromEntries(Object.entries(ids).map(([t, s]) => [t, s])));
        setDeleted(dels.slice(0, MAX_DELETED));
      } catch {
        setUnread({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, storageKey, activeTab]);

  const dismissDeleted = useCallback(() => {
    const now = new Date().toISOString();
    writeDismissedUntil(dismissKey, now);
    setDismissedUntil(now);
  }, [dismissKey]);

  const { subscribeActivity } = useProject();
  useEffect(() => {
    return subscribeActivity((msg) => {
      const tab = tabOfEntity(msg.entry.entity);
      if (tab !== activeTabRef.current) {
        setUnread((prev) => ({ ...prev, [tab]: (prev[tab] ?? 0) + 1 }));
        setUnreadIds((prev) => {
          const next = new Set(prev[tab] ?? []);
          next.add(msg.entry.entityId);
          return { ...prev, [tab]: next };
        });
      }
      if (msg.entry.action === 'deleted') {
        setDeleted((prev) => [...prev, msg.entry].slice(-MAX_DELETED));
      }
    });
  }, [subscribeActivity]);

  return { unread, unreadIds, deleted, dismissedUntil, dismissDeleted };
}
