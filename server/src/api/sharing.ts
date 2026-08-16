import { z } from 'zod';
import type { State } from '../schema/state.js';

export const PUBLIC_TABS = ['board', 'issues', 'stack', 'milestones', 'about', 'whiteboard'] as const;
export type PublicTab = (typeof PUBLIC_TABS)[number];

export const publicTabsSchema = z.array(z.enum(PUBLIC_TABS));

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

export function normalizeTabs(value: unknown): PublicTab[] {
  const parsed = publicTabsSchema.safeParse(value);
  if (!parsed.success) return [...PUBLIC_TABS];
  return [...new Set(parsed.data)];
}

/** Kunci state yang boleh dikirim saat visibility public. */
export function publicStateKeys(tabs: PublicTab[]): Set<keyof State> {
  const keys = new Set<keyof State>();
  for (const tab of tabs) {
    const key = TAB_STATE_KEYS[tab];
    if (key) keys.add(key);
  }
  return keys;
}
