import { z } from 'zod';
import type { State } from './state.js';

export const PUBLIC_TABS = ['board', 'issues', 'stack', 'milestones', 'about', 'whiteboard'] as const;
export type PublicTab = (typeof PUBLIC_TABS)[number];

export const publicTabsSchema = z.array(z.enum(PUBLIC_TABS)).max(PUBLIC_TABS.length);

/**
 * Fail-closed (audit 2026-08b, PUB-2): nilai yang tidak dikenal atau tidak
 * valid → TIDAK ADA tab yang terbuka, bukan semua. Tab yang tidak dikenal
 * lebih aman tidak ditampilkan daripada ditampilkan semua.
 */
export function normalizeTabs(value: unknown): PublicTab[] {
  const parsed = publicTabsSchema.safeParse(value);
  if (!parsed.success) return [];
  return [...new Set(parsed.data)];
}

/**
 * Setiap tab publik memetakan ke kunci state yang ditampilkan.
 * 'about' hanya butuh testCases untuk kartu statistik; jumlah entity lain
 * diturunkan dari array state yang sudah difilter (tab privat → 0).
 */
export const TAB_STATE_KEYS: Record<PublicTab, keyof State | undefined> = {
  board: 'tasks',
  issues: 'issues',
  milestones: 'milestones',
  stack: 'techEntries',
  about: 'testCases',
  whiteboard: 'whiteboards',
};

/** Kunci state yang boleh dikirim saat visibility public. */
export function publicStateKeys(tabs: PublicTab[]): Set<keyof State> {
  const keys = new Set<keyof State>();
  for (const tab of tabs) {
    const key = TAB_STATE_KEYS[tab];
    if (key) keys.add(key);
  }
  return keys;
}