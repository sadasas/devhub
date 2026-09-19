/**
 * Mapping Task DevHub → Google Calendar Event (kontrak locked T3, fondasi Agent A).
 *
 * Kompatibel dua pemanggil:
 * - Agent A (T1/T2/T6): taskToEvent(task, { baseUrl }) dengan task membawa
 *   { id, projectId, title, status, priority, labels, description, startDate, dueDate }.
 *   extendedProperties.private = { devhubTaskId, projectId } (sesuai gcal-mapping.test).
 * - T3 sync-service: taskToEvent(task, projectId) dengan task minimal
 *   { id, title, status, startDate, dueDate, description } + projectId string
 *   sebagai arg kedua (kontrak awal "taskToEvent(task)"; arg kedua opsional).
 *
 * Aturan locked (dipertahankan):
 * - summary prefix '[Done] ' bila done.
 * - all-day: start = startDate ?? dueDate, end = dueDate ?? startDate;
 *   end eksklusif → bila end <= start digeser +1 hari.
 * - extendedProperties.private untuk idempoten (jangan search by title).
 * - Tanpa tanggal → null.
 *
 * Description kaya (agar lolos gcal-mapping.test + link balik ke DevHub):
 *   <deskripsi asli>
 *   Priority: <priority> / Labels: <a, b> / Status: <status>
 *   View task: <baseUrl>/project/<projectId>?entity=tasks&id=<taskId> (bila baseUrl ada)
 *
 * Murni (tanpa I/O) — aman di-unit-test tanpa DB/fetch.
 */

export interface GcalTaskInput {
  id: string;
  projectId?: string;
  title: string;
  status: string;
  priority?: string;
  labels?: string[];
  startDate?: string | null;
  dueDate?: string | null;
  description?: string | null;
}

export interface GcalEventBody {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  extendedProperties: { private: { devhubTaskId: string; projectId: string } };
}

export type TaskToEventOpts = string | { baseUrl?: string; projectId?: string };

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SUMMARY = 500;
const MAX_DESCRIPTION = 10_000;

/** Ambil YYYY-MM-DD dari ISO date-only maupun ISO datetime; null bila invalid. */
export function toDateOnly(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (DATE_ONLY_RE.test(trimmed)) return trimmed;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  const iso = new Date(ms).toISOString().slice(0, 10);
  return iso.length === 10 ? iso : null;
}

/** Tambah N hari ke YYYY-MM-DD (UTC, tanpa DST surprise). */
export function addDays(dateOnly: string, days: number): string {
  const parts = dateOnly.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const iso = dt.toISOString().slice(0, 10);
  return iso.length === 10 ? iso : dateOnly;
}

function resolveProjectId(task: GcalTaskInput, opts?: TaskToEventOpts): string {
  if (typeof task.projectId === 'string' && task.projectId.length > 0) return task.projectId;
  if (typeof opts === 'string' && opts.length > 0) return opts;
  if (opts && typeof opts === 'object' && typeof opts.projectId === 'string' && opts.projectId.length > 0) {
    return opts.projectId;
  }
  return '';
}

function resolveBaseUrl(opts?: TaskToEventOpts): string {
  if (opts && typeof opts === 'object' && typeof opts.baseUrl === 'string') {
    return opts.baseUrl.replace(/\/$/, '');
  }
  return '';
}

function buildDescription(task: GcalTaskInput, projectId: string, baseUrl: string): string {
  const parts: string[] = [];
  const raw = (task.description ?? '').trim();
  if (raw.length > 0) parts.push(raw.slice(0, MAX_DESCRIPTION));
  const priority = (task.priority ?? '').trim() || 'medium';
  const labels = Array.isArray(task.labels) ? task.labels.filter((l) => typeof l === 'string' && l.length > 0) : [];
  const meta: string[] = [`Priority: ${priority}`, `Status: ${task.status}`];
  meta.push(`Labels: ${labels.length > 0 ? labels.join(', ') : '-'}`);
  parts.push(meta.join('\n'));
  if (baseUrl.length > 0 && projectId.length > 0) {
    parts.push(`View task: ${baseUrl}/project/${projectId}?entity=tasks&id=${task.id}`);
  }
  return parts.join('\n\n').slice(0, MAX_DESCRIPTION);
}

/**
 * Kontrak: taskToEvent(task[, opts]).
 * - Agent A: taskToEvent(taskDenganProjectId, { baseUrl })
 * - T3: taskToEvent(taskMinimal, projectIdString)
 */
export function taskToEvent(task: GcalTaskInput, opts?: TaskToEventOpts): GcalEventBody | null {
  const startRaw = task.startDate ?? task.dueDate ?? null;
  const endRaw = task.dueDate ?? task.startDate ?? null;
  if (!startRaw || !endRaw) return null;
  const start = toDateOnly(startRaw);
  const endInitial = toDateOnly(endRaw);
  if (!start || !endInitial) return null;
  let end = endInitial;
  if (end <= start) end = addDays(start, 1);

  const projectId = resolveProjectId(task, opts);
  const baseUrl = resolveBaseUrl(opts);
  const title = (task.title ?? '').trim() || 'Untitled task';
  const summary = `${task.status === 'done' ? '[Done] ' : ''}${title}`.slice(0, MAX_SUMMARY);

  return {
    summary,
    description: buildDescription(task, projectId, baseUrl),
    start: { date: start },
    end: { date: end },
    extendedProperties: { private: { devhubTaskId: task.id, projectId } },
  };
}

/** True bila task punya tanggal yang layak di-sync ke kalender. */
export function hasSyncDates(task: Pick<GcalTaskInput, 'startDate' | 'dueDate'>): boolean {
  return Boolean(task.startDate ?? task.dueDate);
}

const RELEVANT_KEYS = ['title', 'status', 'startDate', 'dueDate', 'description', 'priority', 'labels'] as const;
type RelevantKey = (typeof RELEVANT_KEYS)[number];

/** True bila patch menyentuh field yang relevan untuk kalender (hemat kuota). */
export function isRelevantTaskChange(
  before: Pick<GcalTaskInput, RelevantKey>,
  after: Pick<GcalTaskInput, RelevantKey>,
): boolean {
  return RELEVANT_KEYS.some((k) => {
    const a = before[k] ?? null;
    const b = after[k] ?? null;
    return JSON.stringify(a) !== JSON.stringify(b);
  });
}
