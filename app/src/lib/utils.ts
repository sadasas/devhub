import { i18n, getAppLocale } from '../i18n';
import type { ApiEndpoint, Task, TestCase } from './types';

const shortDateCache = new Map<string, Intl.DateTimeFormat>();

function shortDate(): Intl.DateTimeFormat {
  const locale = getAppLocale();
  let fmt = shortDateCache.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    shortDateCache.set(locale, fmt);
  }
  return fmt;
}

const shortDateNoYearCache = new Map<string, Intl.DateTimeFormat>();

function shortDateNoYear(): Intl.DateTimeFormat {
  const locale = getAppLocale();
  let fmt = shortDateNoYearCache.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    });
    shortDateNoYearCache.set(locale, fmt);
  }
  return fmt;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return shortDate().format(d);
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return i18n.t('common:time.justNow');
  if (min < 60) return i18n.t('common:time.minAgo', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return i18n.t('common:time.hourAgo', { count: h });
  const d = Math.floor(h / 24);
  if (d < 7) return i18n.t('common:time.dayAgo', { count: d });
  return shortDateNoYear().format(new Date(then));
}

export function formatExpiry(iso: string | null | undefined, nowMs = Date.now()): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const diffMs = then - nowMs;
  if (diffMs > 0) {
    const min = Math.floor(diffMs / 60_000);
    if (min < 1) return i18n.t('common:time.inMoments');
    if (min < 60) return i18n.t('common:time.inMin', { count: min });
    const h = Math.floor(min / 60);
    if (h < 24) return i18n.t('common:time.inHour', { count: h });
    const d = Math.floor(h / 24);
    if (d < 7) return i18n.t('common:time.inDay', { count: d });
    return shortDateNoYear().format(new Date(then));
  }
  const absMin = Math.floor(Math.abs(diffMs) / 60_000);
  if (absMin < 1) return i18n.t('common:time.expiredJustNow');
  if (absMin < 60) return i18n.t('common:time.expiredMin', { count: absMin });
  const h = Math.floor(absMin / 60);
  if (h < 24) return i18n.t('common:time.expiredHour', { count: h });
  return i18n.t('common:time.expiredDay', { count: Math.floor(h / 24) });
}

export function newId(): string {
  return crypto.randomUUID();
}

export function shortId(id: string): string {
  return id.slice(0, 6);
}

export function linkedTestCases(taskId: string, testCases: TestCase[]): TestCase[] {
  return testCases.filter((tc) => tc.taskId === taskId);
}

export function isTaskCompletable(task: Task, testCases: TestCase[], tasks?: Task[]): boolean {
  const linked = linkedTestCases(task.id, testCases);
  if (linked.length > 0 && !linked.every((tc) => tc.status === 'pass')) return false;
  // Hard-block: tidak bisa Done selama ada blocker / subtask / checklist belum selesai.
  if (tasks) {
    const openBlockers = [...new Set(task.blockedBy ?? [])]
      .map((id) => tasks.find((t) => t.id === id))
      .filter((t): t is Task => t !== undefined)
      .filter((t) => t.status !== 'done');
    if (openBlockers.length > 0) return false;
    const openSubtasks = tasks.filter((t) => t.parentTaskId === task.id && t.status !== 'done');
    if (openSubtasks.length > 0) return false;
  }
  const checklist = task.checklist ?? [];
  if (checklist.length > 0 && !checklist.every((c) => c.done)) return false;
  return true;
}

export function openBlockerNames(task: Task, tasks: Task[], max = 3): string[] {
  const names = [...new Set(task.blockedBy ?? [])]
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined)
    .filter((t) => t.status !== 'done')
    .map((t) => t.title || 'Untitled task');
  return names.slice(0, max);
}

export function taskBlockSummary(task: Task, testCases: TestCase[], tasks: Task[]): string[] {
  const reasons: string[] = [];
  const pendingTc = testCases.filter((tc) => tc.taskId === task.id && tc.status !== 'pass');
  if (pendingTc.length > 0) reasons.push(`${pendingTc.length} test case`);
  const blockers = openBlockerNames(task, tasks, 99);
  if (blockers.length > 0) reasons.push(`${blockers.length} blocker`);
  const openSub = tasks.filter((t) => t.parentTaskId === task.id && t.status !== 'done');
  if (openSub.length > 0) reasons.push(`${openSub.length} subtask`);
  const openCheck = (task.checklist ?? []).filter((c) => !c.done);
  if (openCheck.length > 0) reasons.push(`${openCheck.length} checklist`);
  return reasons;
}

/** Shared API search predicate (sidebar tree + docs view): name, path, method, description. Empty query matches everything. */
export function matchesApiEndpoint(e: ApiEndpoint, query: string): boolean {
  if (!query) return true;
  return (
    e.name.toLowerCase().includes(query) ||
    e.path.toLowerCase().includes(query) ||
    e.method.toLowerCase().includes(query) ||
    (e.description ? e.description.toLowerCase().includes(query) : false)
  );
}

/** Normalized identity for duplicate detection: METHOD + lowercased path without trailing slash. */
export function normalizeApiKey(method: string, path: string): string {
  const trimmed = path.trim();
  const noSlash = trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : trimmed;
  return `${method.trim().toUpperCase()} ${noSlash.toLowerCase()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function startOfDayMs(dateStr: string): number {
  return Date.parse(`${dateStr}T00:00:00.000Z`);
}

export function deriveActualHours(params: {
  completedAt: string;
  createdAt: string;
  startDate?: string | null;
}): number {
  const base = params.startDate ? startOfDayMs(params.startDate) : Date.parse(params.createdAt);
  const hours = (Date.parse(params.completedAt) - base) / 3.6e6;
  return Math.max(0, Math.round(hours * 10) / 10);
}

export function parseLabels(input: string): string[] {
  const parsed = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  return [...new Set(parsed)];
}

/** Hanya angka + satu titik — buang huruf/simbol, titik ganda disatukan. */
export function sanitizeDecimalInput(input: string): string {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, '')}`;
}

/** Buang semua karakter non-digit — estimate hanya bilangan bulat. */
export function sanitizeIntegerInput(input: string): string {
  return input.replace(/[^0-9]/g, '');
}

/**
 * Guard keystroke input angka: true untuk digit + tombol kontrol
 * (Backspace, Delete, Tab, panah, Enter, Escape, dsb.).
 */
export function isDigitKey(key: string): boolean {
  return key.length !== 1 || /[0-9]/.test(key);
}

/** Guard keystroke estimate desimal: digit + satu titik + tombol kontrol. */
export function isDecimalKey(key: string): boolean {
  return key.length !== 1 || /[0-9.]/.test(key);
}

/** Versi skema (semver): hanya digit + titik, huruf/simbol dibuang, titik ganda diringkas. */
export function sanitizeVersionInput(input: string): string {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  return cleaned.replace(/\.{2,}/g, '.').replace(/^\.+/, '');
}

export function relationLabel(
  fromTable: string | undefined,
  fromColumn: string | undefined,
  toTable: string | undefined,
  toColumn: string | undefined,
): string {
  return `${fromTable ?? '?'}.${fromColumn ?? '?'} → ${toTable ?? '?'}.${toColumn ?? '?'}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Telan sekali klik kompatibel berikutnya (capture). Dipakai backdrop
 * modal/sheet: tutup pada mousedown melepas modal, sehingga klik yang datang
 * sesudahnya mendarat di layer belakang — telan agar tak membuka kartu di
 * bawah jari. Timeout melepas listener bila tak ada klik susulan.
 */
export function swallowNextClick(timeoutMs = 500): void {
  if (typeof window === 'undefined') return;
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    window.removeEventListener('click', onClick, true);
  };
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.clearTimeout(timer);
    cleanup();
  };
  const timer = window.setTimeout(cleanup, timeoutMs);
  window.addEventListener('click', onClick, true);
}
