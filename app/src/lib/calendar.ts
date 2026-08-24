import { getAppLocale } from '../i18n';

export const DAY_MS = 86_400_000;

export function parseIso(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

export function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = parseIso(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return isoOf(d);
}

export function mondayOf(isoDate: string): string {
  const d = parseIso(isoDate);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return isoOf(d);
}

export function monthMatrix(year: number, month: number): string[][] {
  const first = isoOf(new Date(Date.UTC(year, month, 1)));
  let cur = mondayOf(first);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w += 1) {
    const week: string[] = [];
    for (let d = 0; d < 7; d += 1) {
      week.push(cur);
      cur = addDaysIso(cur, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function weekDays(anchorIso: string): string[] {
  const start = mondayOf(anchorIso);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(start, i));
}

export function inMonth(isoDate: string, year: number, month: number): boolean {
  const d = parseIso(isoDate);
  return d.getUTCFullYear() === year && d.getUTCMonth() === month;
}

export function monthName(year: number, month: number): string {
  return new Intl.DateTimeFormat(getAppLocale(), { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(year, month, 1)),
  );
}