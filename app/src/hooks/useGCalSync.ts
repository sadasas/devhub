import { useEffect, useState } from 'react';
import { api, type GCalStatus } from '../lib/api';

export interface GCalSyncState {
  status: GCalStatus | null;
  syncedIds: ReadonlySet<string>;
  loading: boolean;
}

const EMPTY = new Set<string>();
const TTL_MS = 60_000;

interface CacheEntry {
  status: GCalStatus | null;
  ids: ReadonlySet<string>;
  at: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

function fetchEntry(projectId: string): Promise<CacheEntry> {
  const running = inflight.get(projectId);
  if (running) return running;
  const job = Promise.all([api.gcalStatus(projectId), api.gcalSynced(projectId)])
    .then(([nextStatus, nextSynced]): CacheEntry => ({
      status: nextStatus,
      ids: new Set(nextSynced.taskIds ?? []),
      at: Date.now(),
    }))
    .catch((): CacheEntry => ({ status: null, ids: EMPTY, at: Date.now() }))
    .finally(() => {
      inflight.delete(projectId);
    });
  inflight.set(projectId, job);
  return job;
}

/**
 * Status sync Google Calendar per-project + himpunan task yang punya event.
 * Fetch paralel sekali per projectId; gagal = fail-soft (null/kosong) agar
 * board tidak pecah bila endpoint belum ada atau offline.
 */
export function useGCalSync(
  projectId: string | null | undefined,
  opts?: { disabled?: boolean },
): GCalSyncState {
  const cached = projectId && !opts?.disabled ? cache.get(projectId) : undefined;
  const fresh = cached && Date.now() - cached.at < TTL_MS ? cached : undefined;
  const [status, setStatus] = useState<GCalStatus | null>(fresh?.status ?? null);
  const [syncedIds, setSyncedIds] = useState<ReadonlySet<string>>(fresh?.ids ?? EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId || opts?.disabled) {
      setStatus(null);
      setSyncedIds(EMPTY);
      setLoading(false);
      return;
    }
    if (fresh) return;
    let cancelled = false;
    setLoading(true);
    void fetchEntry(projectId).then((entry) => {
      if (cancelled) return;
      cache.set(projectId, entry);
      setStatus(entry.status);
      setSyncedIds(entry.ids);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, opts?.disabled]);

  return { status, syncedIds, loading };
}
