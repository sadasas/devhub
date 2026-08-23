import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ActivityEntry, type GranularEntity } from '../lib/api';
import {
  clearLegacyUnread,
  deletedDismissKey,
  readDismissedUntil,
  readUnreadMap,
  tabOfEntity,
  unreadStorageKey,
} from '../lib/tab-unread';
import { useProject } from '../state/project-context';

const MAX_DELETED = 20;
const DISMISS_KEY = '__deleted_dismiss__';
const WATERMARK_WRITE_DEBOUNCE_MS = 500;

export interface TabUnreadResult {
  unread: Record<string, number>;
  unreadIds: Record<string, ReadonlySet<string>>;
  deleted: ActivityEntry[];
  dismissedUntil: string | null;
  dismissDeleted: () => void;
}

/**
 * Badge unread server-side (ADR M32): angka dihitung SQL di GET /activity/unread
 * berdasarkan watermark baca di DB. Klien tidak lagi menyimpan watermark —
 * ganti tab cukup rekomputasi lokal + PUT debounce; aktivitas baru live via WS.
 */
export function useTabUnread(
  projectId: string,
  userId: string,
  activeTab: string,
): TabUnreadResult {
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [unreadIds, setUnreadIds] = useState<Record<string, ReadonlySet<string>>>({});
  const [deleted, setDeleted] = useState<ActivityEntry[]>([]);
  const [dismissedUntil, setDismissedUntil] = useState<string | null>(null);

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const pendingWritesRef = useRef<Set<string>>(new Set());
  const writeTimerRef = useRef<number | null>(null);

  const flushWatermarkWrites = useCallback(() => {
    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }
    if (pendingWritesRef.current.size === 0) return;
    const tabs = [...pendingWritesRef.current];
    pendingWritesRef.current.clear();
    for (const tab of tabs) {
      void api.setTabReadWatermark(projectId, tab).catch(() => {});
    }
  }, [projectId]);

  const scheduleWatermarkWrite = useCallback(
    (tab: string) => {
      pendingWritesRef.current.add(tab);
      if (writeTimerRef.current !== null) window.clearTimeout(writeTimerRef.current);
      writeTimerRef.current = window.setTimeout(flushWatermarkWrites, WATERMARK_WRITE_DEBOUNCE_MS);
    },
    [flushWatermarkWrites],
  );

  // Satu panggilan kecil per buka project — server yang menghitung.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const summary = await api.fetchActivityUnread(projectId);
        if (cancelled) return;
        const counts = { ...summary.counts };
        delete counts[activeTabRef.current];
        setUnread(counts);
        setUnreadIds(
          Object.fromEntries(
            Object.entries(summary.ids ?? {}).map(([tab, list]) => [tab, new Set(list)]),
          ),
        );
        setDeleted(
          (summary.deleted ?? []).map((d) => ({
            id: d.id,
            projectId,
            entity: d.entity as GranularEntity,
            entityId: d.entityId,
            action: 'deleted' as const,
            authorId: null,
            authorName: d.authorName ?? '',
            summary: d.summary ?? '',
            changes: {},
            createdAt: d.createdAt,
          })),
        );
        const serverDismiss = summary.watermarks?.[DISMISS_KEY] ?? null;
        if (serverDismiss) {
          setDismissedUntil(serverDismiss);
          clearLegacyUnread(deletedDismissKey(projectId));
        } else {
          seedLegacyWatermarks(projectId, userId, summary.watermarks ?? {}, () => {
            const legacy = readDismissedUntil(deletedDismissKey(projectId));
            if (legacy) {
              setDismissedUntil(legacy);
              return true;
            }
            return false;
          });
        }
      } catch {
        if (!cancelled) setUnread({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, userId]);

  // Ganti tab: rekomputasi lokal + tandai tab yang ditinggalkan sudah dibaca.
  // Badge tab yang dimasuki juga dibersihkan (paritas UX dengan perilaku lama).
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = activeTab;
    if (!prev || prev === activeTab) return;
    scheduleWatermarkWrite(prev);
    const cleared = new Set([prev, activeTab]);
    setUnread((map) => {
      if (!Object.keys(map).some((t) => cleared.has(t))) return map;
      const next = { ...map };
      for (const t of cleared) delete next[t];
      return next;
    });
    setUnreadIds((map) => {
      if (!Object.keys(map).some((t) => cleared.has(t))) return map;
      const next = { ...map };
      for (const t of cleared) delete next[t];
      return next;
    });
  }, [activeTab, scheduleWatermarkWrite]);

  const { subscribeActivity } = useProject();
  useEffect(() => {
    return subscribeActivity((msg) => {
      const tab = tabOfEntity(msg.entry.entity);
      if (tab !== activeTabRef.current) {
        setUnread((prev) => ({ ...prev, [tab]: (prev[tab] ?? 0) + 1 }));
        setUnreadIds((prevMap) => {
          const next = new Set(prevMap[tab] ?? []);
          next.add(msg.entry.entityId);
          return { ...prevMap, [tab]: next };
        });
      }
      if (msg.entry.action === 'deleted') {
        setDeleted((prevD) => [...prevD, msg.entry].slice(-MAX_DELETED));
      }
    });
  }, [subscribeActivity]);

  const dismissDeleted = useCallback(() => {
    setDismissedUntil(new Date().toISOString());
    void api.setTabReadWatermark(projectId, DISMISS_KEY).catch(() => {});
  }, [projectId]);

  useEffect(() => flushWatermarkWrites, [flushWatermarkWrites]);

  return { unread, unreadIds, deleted, dismissedUntil, dismissDeleted };
}

/** Migrasi sekali: watermark lama di localStorage → server, lalu hapus lokal. */
function seedLegacyWatermarks(
  projectId: string,
  userId: string,
  serverMarks: Record<string, string>,
  adoptLegacyDismiss: () => boolean,
): void {
  try {
    if (Object.keys(serverMarks).length > 0) {
      clearLegacyUnread(unreadStorageKey(projectId, userId));
      clearLegacyUnread(deletedDismissKey(projectId));
      return;
    }
    const legacy = readUnreadMap(unreadStorageKey(projectId, userId));
    const dismissedAdopted = adoptLegacyDismiss();
    const tabs = Object.keys(legacy);
    if (tabs.length === 0 && !dismissedAdopted) return;
    for (const tab of tabs) {
      void api.setTabReadWatermark(projectId, tab).catch(() => {});
    }
    if (dismissedAdopted) {
      void api.setTabReadWatermark(projectId, DISMISS_KEY).catch(() => {});
    }
    clearLegacyUnread(unreadStorageKey(projectId, userId));
    clearLegacyUnread(deletedDismissKey(projectId));
  } catch {
    /* seeding is best-effort */
  }
}
