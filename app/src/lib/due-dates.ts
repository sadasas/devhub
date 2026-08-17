export type DueBucket =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'thisWeek'
  | 'nextWeek'
  | 'later'
  | 'none';

export type DueTone = 'danger' | 'warn' | 'neutral';

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

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function dueLabel(dueDate: string | null | undefined, today = todayIso()): string {
  if (!dueDate) return '';
  const bucket = dueBucket(dueDate, today);
  if (bucket === 'overdue') {
    const days = dayIndex(today) - dayIndex(dueDate);
    return days === 1 ? 'Overdue 1d' : `Overdue ${days}d`;
  }
  if (bucket === 'today') return 'Due today';
  if (bucket === 'tomorrow') return 'Due tomorrow';
  return `Due ${shortDate.format(new Date(`${dueDate}T00:00:00Z`))}`;
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