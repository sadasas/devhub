export type SortDir = 'asc' | 'desc';

export interface SortSpec<T> {
  key: string;
  label: string;
  get: (item: T) => string | number | null | undefined;
  order?: readonly string[];
  compare?: (a: string, b: string) => number;
}

function rank(spec: SortSpec<unknown>, value: unknown): number {
  if (typeof value !== 'string' || !spec.order) return NaN;
  return spec.order.indexOf(value);
}

function compareValues(spec: SortSpec<unknown>, a: unknown, b: unknown): number {
  const ra = rank(spec, a);
  const rb = rank(spec, b);
  if (!Number.isNaN(ra) && !Number.isNaN(rb)) return ra - rb;
  const na = a == null;
  const nb = b == null;
  if (na || nb) return na && nb ? 0 : na ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (spec.compare) return spec.compare(String(a), String(b));
  return String(a).localeCompare(String(b));
}

export function applySort<T>(
  items: readonly T[],
  spec: SortSpec<T> | null,
  dir: SortDir,
  pinnedFirst?: (item: T) => boolean,
): T[] {
  if (!spec && !pinnedFirst) return [...items];
  const factor = dir === 'desc' ? -1 : 1;
  const s = spec as SortSpec<unknown>;
  return [...items].sort((a, b) => {
    if (pinnedFirst) {
      const pa = pinnedFirst(a);
      const pb = pinnedFirst(b);
      if (pa !== pb) return pa ? -1 : 1;
    }
    if (!spec) return 0;
    const va = spec.get(a);
    const vb = spec.get(b);
    const na = va == null;
    const nb = vb == null;
    if (na || nb) return na && nb ? 0 : na ? 1 : -1;
    return factor * compareValues(s, va, vb);
  });
}