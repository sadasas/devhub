import { describe, expect, it } from 'vitest';
import { reconcileQueue } from './sync-service';
import type { PendingMutation } from './storage-provider';
import type { State } from './types';

const layoutMutation = (): PendingMutation => ({
  key: 'erdLayout:layout',
  entity: 'erdLayout',
  op: 'update',
  id: 'layout',
  payload: {},
});

const stateWithLayout = (erdLayout: unknown): State =>
  ({ erdLayout } as unknown as State);

describe('reconcileQueue — single-doc erdLayout', () => {
  it('keep saat layout lokal berbeda dari server (409 lain tak boleh drop layout)', () => {
    const { keep, dropped } = reconcileQueue(
      [layoutMutation()],
      stateWithLayout({ tb1: { x: 1, y: 1 } }),
      stateWithLayout({
        tb1: { x: 1, y: 1 },
        tb2: { x: 30, y: 40 },
      }),
    );
    expect(keep.map((m) => m.key)).toEqual(['erdLayout:layout']);
    expect(dropped).toEqual([]);
  });

  it('drop saat layout lokal sudah sama dengan server', () => {
    const doc = { tb1: { x: 1, y: 1 } };
    const { keep, dropped } = reconcileQueue(
      [layoutMutation()],
      stateWithLayout(doc),
      stateWithLayout({ ...doc }),
    );
    expect(keep).toEqual([]);
    expect(dropped).toEqual(['erdLayout:layout']);
  });
});
