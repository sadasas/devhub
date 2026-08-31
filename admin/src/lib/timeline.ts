import type { Task } from './types';
import { addDaysIso, parseIso } from './calendar';

export type TimelineZoom = 'day';
export type TimelineGroup = 'none' | 'milestone' | 'assignee';

export const TIMELINE_ZOOMS: TimelineZoom[] = ['day'];
export const TIMELINE_GROUPS: TimelineGroup[] = ['none', 'milestone', 'assignee'];

export const TIMELINE_COL_WIDTH: Record<TimelineZoom, number> = {
  day: 80,
};

const DAY_MS = 86_400_000;

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayIndex(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

export function isUnscheduled(task: Task): boolean {
  return task.startDate == null || task.dueDate == null;
}

export interface BarGeometry {
  left: number;
  width: number;
  isPoint: boolean;
  startDate: string;
  endDate: string;
  spanDays: number;
}

/**
 * Hitung geometri bar — hanya task dengan start DAN due yang tampil di grid.
 */
export function barGeometry(
  task: Task,
  viewportStart: string,
  zoom: TimelineZoom,
): BarGeometry | null {
  if (isUnscheduled(task)) return null;
  let start = task.startDate!;
  let end = task.dueDate!;
  // normalize: jika start > end, swap (edge case startAfterDue)
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  const startIdx = dayIndex(start);
  const endIdx = dayIndex(end);
  const vpIdx = dayIndex(viewportStart);
  const spanDays = endIdx - startIdx + 1;
  const colW = TIMELINE_COL_WIDTH[zoom];
  const isPoint = spanDays <= 1;
  const left = (startIdx - vpIdx) * colW;
  const width = isPoint ? Math.max(12, colW - 4) : Math.max(12, spanDays * colW - 4);
  return { left, width, isPoint, startDate: start, endDate: end, spanDays };
}

export function timelineWindow(
  anchor: string = todayIso(),
  beforeDays = 7,
  afterDays = 28,
): { start: string; end: string; days: string[] } {
  const start = addDaysIso(anchor, -beforeDays);
  const end = addDaysIso(anchor, afterDays);
  const total = dayIndex(end) - dayIndex(start) + 1;
  const days: string[] = [];
  for (let i = 0; i < total; i++) {
    days.push(addDaysIso(start, i));
  }
  return { start, end, days };
}

export function headerMonthLabel(days: string[]): Array<{ label: string; span: number; key: string }> {
  const out: Array<{ label: string; span: number; key: string }> = [];
  let curKey = '';
  let curSpan = 0;
  for (const d of days) {
    const ym = d.slice(0, 7); // YYYY-MM
    if (ym !== curKey) {
      if (curKey) out.push({ label: monthLabelForKey(curKey), span: curSpan, key: curKey });
      curKey = ym;
      curSpan = 0;
    }
    curSpan += 1;
  }
  if (curKey) out.push({ label: monthLabelForKey(curKey), span: curSpan, key: curKey });
  return out;
}

function monthLabelForKey(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1, 1));
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function isWeekend(iso: string): boolean {
  const d = parseIso(iso);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

export function dateToOffset(date: string, viewportStart: string, zoom: TimelineZoom): number {
  return (dayIndex(date) - dayIndex(viewportStart)) * TIMELINE_COL_WIDTH[zoom];
}

// helpers for drag
export function addDaysToDate(iso: string, deltaDays: number): string {
  return addDaysIso(iso, deltaDays);
}

export function isoToDayIndex(iso: string): number {
  return dayIndex(iso);
}

export function clampZoom(v: string | null): TimelineZoom {
  if (v === 'day') return v;
  return 'day';
}

export function clampGroup(v: string | null): TimelineGroup {
  if (v === 'milestone' || v === 'assignee') return v;
  return 'none';
}

// For whiteboard export parity, not needed here
export function taskSpanDays(task: Task): number | null {
  const s = task.startDate;
  const e = task.dueDate;
  if (!s || !e) return null;
  return dayIndex(e) - dayIndex(s) + 1;
}
