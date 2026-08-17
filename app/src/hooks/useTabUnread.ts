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

  const [unread, setUnread] = useState<Record<string, number>>({});
  const [deleted, setDeleted] = useState<ActivityEntry[]>([]);
  const [dismissedUntil, setDismissedUntil] = useState<string | null>(() =>
    readDismissedUntil(dismissKey),
  );

  useEffect(() => {
    lastReadRef.current = readUnreadMap(storageKey);
    let cancelled = false;
    void (async () => {
      try {
        const items = await api.fetchActivity(projectId, { limit: FETCH_PAGE_LIMIT });
        if (cancelled) return;
        const counts: Record<string, number> = {};
        const dels: ActivityEntry[] = [];
        for (const entry of items) {
          const tab = tabOfEntity(entry.entity);
          const last = lastReadRef.current[tab];
          if (!last || new Date(entry.createdAt).getTime() > new Date(last).getTime()) {
            counts[tab] = (counts[tab] ?? 0) + 1;
          }
          if (entry.action === 'deleted') dels.push(entry);
        }
        setUnread(counts);
        setDeleted(dels.slice(0, MAX_DELETED));
      } catch {
        setUnread({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, storageKey]);

  useEffect(() => {
    const map = { ...lastReadRef.current, [activeTab]: new Date().toISOString() };
    lastReadRef.current = map;
    writeUnreadMap(storageKey, map);
    setUnread((prev) => (prev[activeTab] ? { ...prev, [activeTab]: 0 } : prev));
  }, [activeTab, storageKey]);

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
      }
      if (msg.entry.action === 'deleted') {
        setDeleted((prev) => [...prev, msg.entry].slice(-MAX_DELETED));
      }
    });
  }, [subscribeActivity]);

  return { unread, deleted, dismissedUntil, dismissDeleted };
}
