import { describe, expect, it } from 'vitest';
import { applySort, type SortSpec } from './sort';

interface Item {
  id: number;
  name: string;
  num?: number;
  date?: string | null;
  kind: string;
}

const spec = (key: keyof Item): SortSpec<Item> => ({
  key,
  label: key,
  get: (i) => i[key],
});

describe('applySort', () => {
  const items: Item[] = [
    { id: 1, name: 'banana', num: 3, date: '2026-03-01', kind: 'b' },
    { id: 2, name: 'apple', num: 1, date: '2026-01-01', kind: 'a' },
    { id: 3, name: 'cherry', num: 2, date: null, kind: 'a' },
  ];

  it('sorts strings with localeCompare', () => {
    expect(applySort(items, spec('name'), 'asc').map((i) => i.name)).toEqual([
      'apple',
      'banana',
      'cherry',
    ]);
  });

  it('reverses with desc', () => {
    expect(applySort(items, spec('name'), 'desc').map((i) => i.name)).toEqual([
      'cherry',
      'banana',
      'apple',
    ]);
  });

  it('sorts numbers', () => {
    expect(applySort(items, spec('num'), 'asc').map((i) => i.num)).toEqual([1, 2, 3]);
  });

  it('keeps null/undefined values last in both directions', () => {
    expect(applySort(items, spec('date'), 'asc').map((i) => i.date)).toEqual([
      '2026-01-01',
      '2026-03-01',
      null,
    ]);
    expect(applySort(items, spec('date'), 'desc').map((i) => i.date)).toEqual([
      '2026-03-01',
      '2026-01-01',
      null,
    ]);
  });

  it('ranks enum values by the order array', () => {
    const s: SortSpec<Item> = { key: 'kind', label: 'Kind', get: (i) => i.kind, order: ['a', 'b'] };
    expect(applySort(items, s, 'asc').map((i) => i.kind)).toEqual(['a', 'a', 'b']);
    expect(applySort(items, s, 'desc').map((i) => i.kind)).toEqual(['b', 'a', 'a']);
  });

  it('falls back to string comparison for unknown enum values', () => {
    const s: SortSpec<Item> = { key: 'kind', label: 'Kind', get: (i) => i.kind, order: ['b'] };
    expect(applySort(items, s, 'asc').map((i) => i.kind)).toEqual(['a', 'a', 'b']);
  });

  it('returns a copy in original order when the spec is null', () => {
    const copy = applySort(items, null, 'asc');
    expect(copy.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(copy).not.toBe(items);
  });

  it('does not mutate the input array', () => {
    const before = items.map((i) => i.id);
    applySort(items, spec('name'), 'desc');
    expect(items.map((i) => i.id)).toEqual(before);
  });
});