import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ActivityEntry, type GranularEntity } from '../lib/api';
import {
  clearLegacyUnread,
  deletedDismissKey,
  dismissKeyForTab,
  DISMISS_PREFIX,
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
  unread: Record<string, { new: number; deleted: number; total: number }>;
  unreadIds: Record<string, { new: ReadonlySet<string>; deleted: ReadonlySet<string> }>;
  deleted: ActivityEntry[];
  dismissedUntil: Record<string, string | null>;
  dismissDeleted: (tab: string) => void;
}

/**
 * Badge unread server-side (M38): hanya hit new (created) + deleted,
 * updated diabaikan. Badge hilang saat pindah tab (bukan saat masuk).
 * Banner deleted per tab via dismissKeyForTab.
 */
export function useTabUnread(
  projectId: string,
  userId: string,
  activeTab: string,
): TabUnreadResult {
  const [unread, setUnread] = useState<Record<string, { new: number; deleted: number; total: number }>>({});
  const [unreadIds, setUnreadIds] = useState<Record<string, { new: ReadonlySet<string>; deleted: ReadonlySet<string> }>>({});
  const [deleted, setDeleted] = useState<ActivityEntry[]>([]);
  const [dismissedUntil, setDismissedUntil] = useState<Record<string, string | null>>({});

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
      void api.setTabReadWatermark(projectId, tab).then(() => {
        try { window.dispatchEvent(new CustomEvent('devhub:read-watermark', { detail: { projectId, tab } })); } catch { /* ignore */ }
      }).catch(() => {});
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

  // Satu panggilan kecil per buka project — server yang menghitung (new+deleted only).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const summary: any = await api.fetchActivityUnread(projectId);
        if (cancelled) return;

        // Normalisasi counts: support legacy number & new object shape
        const rawCounts = summary.counts ?? {};
        const normCounts: Record<string, { new: number; deleted: number; total: number }> = {};
        for (const [tab, val] of Object.entries(rawCounts)) {
          if (typeof val === 'number') {
            normCounts[tab] = { new: val as number, deleted: 0, total: val as number };
          } else if (val && typeof val === 'object') {
            const v = val as { new?: number; deleted?: number; total?: number };
            const n = v.new ?? 0;
            const d = v.deleted ?? 0;
            normCounts[tab] = { new: n, deleted: d, total: v.total ?? n + d };
          }
        }
        // JANGAN hapus activeTab — biar dot tetap kelihatan saat pertama masuk (hilang saat pindah tab)
        setUnread(normCounts);

        const rawIds = summary.ids ?? {};
        const normIds: Record<string, { new: ReadonlySet<string>; deleted: ReadonlySet<string> }> = {};
        for (const [tab, val] of Object.entries(rawIds)) {
          if (Array.isArray(val)) {
            normIds[tab] = { new: new Set(val as string[]), deleted: new Set() };
          } else if (val && typeof val === 'object') {
            const v = val as { new?: string[]; deleted?: string[] };
            normIds[tab] = { new: new Set(v.new ?? []), deleted: new Set(v.deleted ?? []) };
          }
        }
        setUnreadIds(normIds);

        setDeleted(
          (summary.deleted ?? []).map((d: any) => ({
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
            tab: d.tab ?? tabOfEntity(d.entity as GranularEntity),
          })) as unknown as ActivityEntry[],
        );

        const marks = summary.watermarks ?? {};
        const perTabDismiss: Record<string, string | null> = {};
        const globalDismiss = marks[DISMISS_KEY] ?? null;
        for (const [k, v] of Object.entries(marks)) {
          if ((k as string).startsWith(DISMISS_PREFIX)) {
            const tab = (k as string).slice(DISMISS_PREFIX.length);
            perTabDismiss[tab] = v as string;
          }
        }
        if (globalDismiss && Object.keys(perTabDismiss).length === 0) {
          const knownTabs = ['board','issues','tests','stack','schema','decisions','releases','api','whiteboard'];
          for (const t of knownTabs) perTabDismiss[t] = globalDismiss;
          clearLegacyUnread(deletedDismissKey(projectId));
        } else if (Object.keys(marks).length === 0) {
          seedLegacyWatermarks(projectId, userId, marks, (tab, legacyVal) => {
            perTabDismiss[tab] = legacyVal;
            return true;
          });
        }
        setDismissedUntil(perTabDismiss);
        clearLegacyUnread(unreadStorageKey(projectId, userId));
        if (globalDismiss) clearLegacyUnread(deletedDismissKey(projectId));
      } catch {
        if (!cancelled) {
          setUnread({});
          setUnreadIds({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, userId]);

  // Ganti tab: hanya tandai tab yang ditinggalkan sudah dibaca (hilang saat pindah tab).
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = activeTab;
    if (!prev || prev === activeTab) return;
    scheduleWatermarkWrite(prev);
    setUnread((map) => {
      if (!(prev in map)) return map;
      const next = { ...map };
      delete next[prev];
      return next;
    });
    setUnreadIds((map) => {
      if (!(prev in map)) return map;
      const next = { ...map };
      delete next[prev];
      return next;
    });
  }, [activeTab, scheduleWatermarkWrite]);

  const { subscribeActivity } = useProject();
  useEffect(() => {
    return subscribeActivity((msg) => {
      if (msg.entry.action !== 'created' && msg.entry.action !== 'deleted') return;
      const tab = tabOfEntity(msg.entry.entity);
      if (tab !== activeTabRef.current) {
        setUnread((prev) => {
          const cur = prev[tab] ?? { new: 0, deleted: 0, total: 0 };
          const isNew = msg.entry.action === 'created';
          const next = {
            new: cur.new + (isNew ? 1 : 0),
            deleted: cur.deleted + (isNew ? 0 : 1),
            total: cur.total + 1,
          };
          return { ...prev, [tab]: next };
        });
        setUnreadIds((prevMap) => {
          const cur = prevMap[tab] ?? { new: new Set(), deleted: new Set() };
          const isNew = msg.entry.action === 'created';
          const nextNew = new Set(cur.new);
          const nextDel = new Set(cur.deleted);
          if (isNew) nextNew.add(msg.entry.entityId);
          else nextDel.add(msg.entry.entityId);
          return { ...prevMap, [tab]: { new: nextNew, deleted: nextDel } };
        });
      }
      if (msg.entry.action === 'deleted') {
        setDeleted((prevD) => [...prevD, msg.entry].slice(-MAX_DELETED));
      }
    });
  }, [subscribeActivity]);

  const dismissDeleted = useCallback(
    (tab: string) => {
      const key = dismissKeyForTab(tab);
      setDismissedUntil((prev) => ({ ...prev, [tab]: new Date().toISOString() }));
      void api.setTabReadWatermark(projectId, key).catch(() => {});
    },
    [projectId],
  );

  useEffect(() => flushWatermarkWrites, [flushWatermarkWrites]);

  return { unread, unreadIds, deleted, dismissedUntil, dismissDeleted };
}

function seedLegacyWatermarks(
  projectId: string,
  userId: string,
  serverMarks: Record<string, string>,
  onAdopt: (tab: string, val: string) => boolean,
): void {
  try {
    if (Object.keys(serverMarks).length > 0) {
      clearLegacyUnread(unreadStorageKey(projectId, userId));
      clearLegacyUnread(deletedDismissKey(projectId));
      return;
    }
    const legacy = readUnreadMap(unreadStorageKey(projectId, userId));
    const legacyDismiss = readDismissedUntil(deletedDismissKey(projectId));
    if (legacyDismiss) {
      const knownTabs = ['board','issues','tests','stack','schema','decisions','releases','api','whiteboard'];
      for (const t of knownTabs) {
        if (onAdopt(t, legacyDismiss)) void api.setTabReadWatermark(projectId, dismissKeyForTab(t)).catch(() => {});
      }
    }
    const tabs = Object.keys(legacy);
    if (tabs.length === 0 && !legacyDismiss) return;
    for (const tab of tabs) {
      void api.setTabReadWatermark(projectId, tab).catch(() => {});
    }
    clearLegacyUnread(unreadStorageKey(projectId, userId));
    clearLegacyUnread(deletedDismissKey(projectId));
  } catch {
    /* seeding is best-effort */
  }
}
