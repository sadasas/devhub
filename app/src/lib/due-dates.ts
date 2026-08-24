import { i18n, getAppLocale } from '../i18n';
import type { Task } from './types';

export type DueBucket =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'thisWeek'
  | 'nextWeek'
  | 'later'
  | 'none';

export type DueTone = 'danger' | 'warn' | 'neutral' | 'success';

const DAY_MS = 86_400_000;

function dayIndex(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);
}

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dueBucket(dueDate: string | null | undefined, today = todayIso()): DueBucket {
  if (!dueDate) return 'none';
  const diff = dayIndex(dueDate) - dayIndex(today);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'thisWeek';
  if (diff <= 14) return 'nextWeek';
  return 'later';
}

const COLUMN_OFFSETS: Record<Exclude<DueBucket, 'none'>, number> = {
  overdue: -1,
  today: 0,
  tomorrow: 1,
  thisWeek: 2,
  nextWeek: 8,
  later: 15,
};

export function dueColumnDate(bucket: DueBucket, today = todayIso()): string | null {
  if (bucket === 'none') return null;
  return addDays(today, COLUMN_OFFSETS[bucket]);
}

const shortDateCache = new Map<string, Intl.DateTimeFormat>();

function shortDate(): Intl.DateTimeFormat {
  const locale = getAppLocale();
  let fmt = shortDateCache.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
    shortDateCache.set(locale, fmt);
  }
  return fmt;
}

export function dueLabel(dueDate: string | null | undefined, today = todayIso()): string {
  if (!dueDate) return '';
  const bucket = dueBucket(dueDate, today);
  if (bucket === 'overdue') {
    const days = dayIndex(today) - dayIndex(dueDate);
    return i18n.t('common:due.overdueDays', { count: days });
  }
  if (bucket === 'today') return i18n.t('common:due.today');
  if (bucket === 'tomorrow') return i18n.t('common:due.tomorrow');
  return i18n.t('common:due.dated', {
    date: shortDate().format(new Date(`${dueDate}T00:00:00Z`)),
  });
}

export function dueTone(bucket: DueBucket): DueTone {
  switch (bucket) {
    case 'overdue':
    case 'today':
      return 'danger';
    case 'tomorrow':
    case 'thisWeek':
      return 'warn';
    default:
      return 'neutral';
  }
}

export interface DueChip {
  label: string;
  tone: DueTone;
}

export function taskDueChip(
  task: Pick<Task, 'status' | 'dueDate' | 'completedAt'>,
  today = todayIso(),
): DueChip {
  if (task.status === 'done' && task.completedAt && task.dueDate) {
    const doneDay = task.completedAt.slice(0, 10);
    if (doneDay <= task.dueDate) return { label: i18n.t('common:due.doneOnTime'), tone: 'success' };
    const days = dayIndex(doneDay) - dayIndex(task.dueDate);
    return { label: i18n.t('common:due.doneLate', { count: days }), tone: 'warn' };
  }
  return { label: dueLabel(task.dueDate, today), tone: dueTone(dueBucket(task.dueDate, today)) };
}