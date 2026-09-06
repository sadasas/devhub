import { Bug, Flag, LinkSimple, ListChecks } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

/**
 * Ikon konsep — WAJIB sama di semua form (task/issue/test/stack/decision/release,
 * mode new maupun edit). Jangan pakai ikon lain untuk konsep di bawah ini.
 */
export const CONCEPT_ICON = {
  task: LinkSimple,
  issue: Bug,
  testcase: ListChecks,
  milestone: Flag,
} as const satisfies Record<string, Icon>;
