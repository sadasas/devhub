import { describe, expect, it } from 'vitest';
import { ERD_GROUP_MARGIN, dropTargetGroup, layoutGroups, resizeBox, resolveGroupBox } from './erd-groups';
import type { ErdGroup, Table } from '../../lib/types';

function makeTable(id: string, name: string): Table {
  return {
    id,
    name,
    comment: '',
    columns: [{ id: `c-${id}`, name: 'id', type: 'uuid', nullable: false, primaryKey: true, default: null, comment: '' }],
    indexes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeGroup(over: Partial<ErdGroup> = {}): ErdGroup {
  return {
    id: 'g1',
    name: 'Billing',
    color: null,
    tableIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const TABLE_W = 208;

describe('layoutGroups (pure, never-throw, deterministik)', () => {
  it('bounds = min/max anggota + margin', () => {
    const layouts = [
      { table: makeTable('tb1', 'users'), x: 16, y: 16, h: 100 },
      { table: makeTable('tb2', 'projects'), x: 272, y: 200, h: 60 },
    ];
    const [box] = layoutGroups([makeGroup({ tableIds: ['tb1', 'tb2'] })], layouts, TABLE_W);
    expect(box).toBeTruthy();
    expect(box!.x).toBe(16 - ERD_GROUP_MARGIN);
    expect(box!.y).toBe(16 - ERD_GROUP_MARGIN);
    expect(box!.w).toBe(272 + TABLE_W - 16 + ERD_GROUP_MARGIN * 2);
    expect(box!.h).toBe(200 + 60 - 16 + ERD_GROUP_MARGIN * 2);
  });

  it('skip grup tanpa anggota / id tak dikenal / duplikat', () => {
    const layouts = [{ table: makeTable('tb1', 'users'), x: 16, y: 16, h: 100 }];
    expect(layoutGroups([makeGroup({ tableIds: [] })], layouts, TABLE_W)).toEqual([]);
    expect(layoutGroups([makeGroup({ tableIds: ['nope'] })], layouts, TABLE_W)).toEqual([]);
    const [box] = layoutGroups([makeGroup({ tableIds: ['tb1', 'tb1'] })], layouts, TABLE_W);
    expect(box!.w).toBe(TABLE_W + ERD_GROUP_MARGIN * 2);
  });

  it('input rusak -> [] (never-throw)', () => {
    expect(layoutGroups(null as never, [], TABLE_W)).toEqual([]);
    expect(layoutGroups([], null as never, TABLE_W)).toEqual([]);
    expect(layoutGroups([{ id: 1 } as never], [], TABLE_W)).toEqual([]);
  });
});

describe('dropTargetGroup (drop spasial join/leave)', () => {
  const layouts = [
    { table: makeTable('tb1', 'users'), x: 16, y: 16, h: 64 },
    { table: makeTable('tb2', 'projects'), x: 272, y: 16, h: 64 },
  ];
  // tb2 box (272,16,208,64) -> bounds (256,0,240,96) tanpa tb1.
  const g1 = makeGroup({ id: 'g1', tableIds: ['tb2'] });

  it('titik di dalam bounds (tanpa tabel yang digeser) -> grup itu', () => {
    expect(dropTargetGroup([g1], layouts, TABLE_W, 'tb1', { x: 300, y: 40 })?.id).toBe('g1');
    expect(dropTargetGroup([g1], layouts, TABLE_W, 'tb1', { x: 256, y: 0 })?.id).toBe('g1');
  });

  it('di luar semua bounds -> null (caller melepas membership)', () => {
    expect(dropTargetGroup([g1], layouts, TABLE_W, 'tb1', { x: 100, y: 40 })).toBeNull();
    expect(dropTargetGroup([g1], layouts, TABLE_W, 'tb2', { x: 100, y: 40 })).toBeNull();
  });

  it('overlap -> bounds terkecil menang', () => {
    const layouts3 = [
      ...layouts,
      { table: makeTable('tb3', 'orders'), x: 528, y: 16, h: 64 },
    ];
    const big = makeGroup({ id: 'big', tableIds: ['tb2', 'tb3'] });
    // Titik di tb2 masuk big + g1 -> g1 (lebih kecil) menang.
    expect(dropTargetGroup([big, g1], layouts3, TABLE_W, 'tb1', { x: 300, y: 40 })?.id).toBe('g1');
  });

  it('grup kosong / input rusak -> null (never-throw)', () => {
    expect(dropTargetGroup([makeGroup({ tableIds: [] })], layouts, TABLE_W, 'tb1', { x: 300, y: 40 })).toBeNull();
    expect(dropTargetGroup([g1], layouts, TABLE_W, '', { x: 300, y: 40 })).toBeNull();
    expect(dropTargetGroup([g1], layouts, TABLE_W, 'tb1', { x: NaN, y: 40 })).toBeNull();
    expect(dropTargetGroup(null as never, layouts, TABLE_W, 'tb1', { x: 300, y: 40 })).toBeNull();
  });
});

describe('resolveGroupBox (eksplisit diutamakan, turunan fallback)', () => {
  const layouts = [{ table: makeTable('tb1', 'users'), x: 16, y: 16, h: 64 }];

  it('geometri lengkap -> dipakai apa adanya', () => {
    const box = resolveGroupBox(makeGroup({ tableIds: ['tb1'], x: 0, y: 0, w: 512, h: 112 }), layouts, TABLE_W);
    expect(box).toMatchObject({ x: 0, y: 0, w: 512, h: 112 });
  });

  it('tanpa geometri -> bounds turunan; tanpa keduanya -> null', () => {
    const box = resolveGroupBox(makeGroup({ tableIds: ['tb1'] }), layouts, TABLE_W);
    expect(box).toMatchObject({ x: 0, y: 0, w: 240, h: 96 });
    expect(resolveGroupBox(makeGroup({ tableIds: ['nope'] }), layouts, TABLE_W)).toBeNull();
    expect(resolveGroupBox(null as never, layouts, TABLE_W)).toBeNull();
  });
});

describe('resizeBox (sudut dikunci, min clamp)', () => {
  const orig = { x: 0, y: 0, w: 512, h: 112 };

  it('se memperbesar; nw menggeser origin', () => {
    expect(resizeBox(orig, 'se', 100, 50)).toEqual({ x: 0, y: 0, w: 612, h: 162 });
    expect(resizeBox(orig, 'nw', 100, 50)).toEqual({ x: 100, y: 32, w: 412, h: 80 });
  });

  it('menjepit ke minimum 120x80', () => {
    expect(resizeBox(orig, 'se', -1000, -1000)).toEqual({ x: 0, y: 0, w: 120, h: 80 });
    expect(resizeBox(orig, 'nw', 1000, 1000)).toEqual({ x: 392, y: 32, w: 120, h: 80 });
  });

  it('input rusak -> fallback aman', () => {
    expect(resizeBox(null as never, 'se', 0, 0)).toEqual({ x: 0, y: 0, w: 120, h: 80 });
    expect(resizeBox(orig, 'xx' as never, 10, 10)).toEqual({ x: 0, y: 0, w: 522, h: 122 });
  });
});
