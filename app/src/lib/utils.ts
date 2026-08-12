import type { Task, TestCase } from './types';

const shortDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const shortDateNoYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return shortDate.format(d);
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return shortDateNoYear.format(new Date(then));
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

export function isTaskCompletable(task: Task, testCases: TestCase[]): boolean {
  const linked = linkedTestCases(task.id, testCases);
  if (linked.length === 0) return true;
  return linked.every((tc) => tc.status === 'pass');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseLabels(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
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
