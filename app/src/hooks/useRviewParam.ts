import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { Milestone } from '../lib/types';

export type Rview = 'list' | 'timeline';

function autoPickMilestone(milestones: Milestone[]): string | null {
  const inProgress = milestones
    .filter((m) => m.status === 'inProgress')
    .sort((a, b) => (a.targetDate ?? '9999-99-99').localeCompare(b.targetDate ?? '9999-99-99'));
  if (inProgress.length > 0) return inProgress[0]!.id;
  const planned = milestones
    .filter((m) => m.status === 'planned')
    .sort((a, b) => (a.targetDate ?? '9999-99-99').localeCompare(b.targetDate ?? '9999-99-99'));
  if (planned.length > 0) return planned[0]!.id;
  const sorted = [...milestones].sort((a, b) =>
    (a.targetDate ?? '9999-99-99').localeCompare(b.targetDate ?? '9999-99-99'),
  );
  return sorted[0]?.id ?? null;
}

export function useRviewParam(milestones: Milestone[]): {
  rview: Rview;
  mid: string | null;
  setRview: (next: Rview, opts?: { mid?: string | null }) => void;
  setMid: (id: string | null) => void;
  autoPick: string | null;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('rview');
  const rview: Rview = raw === 'timeline' || raw === 'flow' ? 'timeline' : 'list';
  const mid = searchParams.get('mid');

  const autoPick = useMemo(() => autoPickMilestone(milestones), [milestones]);

  const setRview = useCallback(
    (next: Rview, opts?: { mid?: string | null }) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('rview', next);
          // timeline with mid not needed for list; if mid requested set it
          if (opts?.mid) p.set('mid', opts.mid);
          if (next === 'list') {
            // keep mid for detail page? detail uses mid regardless of rview; do not delete here
          }
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setMid = useCallback(
    (id: string | null) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (id) p.set('mid', id);
          else p.delete('mid');
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { rview, mid, setRview, setMid, autoPick };
}
