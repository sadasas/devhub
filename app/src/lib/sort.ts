export type SortDir = 'asc' | 'desc';

export interface SortSpec<T> {
  key: string;
  label: string;
  get: (item: T) => string | number | null | undefined;
  order?: readonly string[];
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
  return String(a).localeCompare(String(b));
}

export function applySort<T>(
  items: readonly T[],
  spec: SortSpec<T> | null,
  dir: SortDir,
): T[] {
  if (!spec) return [...items];
  const factor = dir === 'desc' ? -1 : 1;
  const s = spec as SortSpec<unknown>;
  return [...items].sort((a, b) => {
    const va = spec.get(a);
    const vb = spec.get(b);
    const na = va == null;
    const nb = vb == null;
    if (na || nb) return na && nb ? 0 : na ? 1 : -1;
    return factor * compareValues(s, va, vb);
  });
}