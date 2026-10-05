import { pool } from '../../../db/pool.js';
import { ApiError } from '../../../shared/errors.js';

/**
 * Statistik profil gaya GitHub (ADR-039): agregasi per-user dari
 * activity_log (author_id dicap server, bukan client-supplied).
 * Catatan: aktivitas di-prune (500/project, 50/entity) sehingga angka
 * mencerminkan aktivitas terbaru, bukan audit all-time yang presisi.
 *
 * Prinsip biaya (2026-10-05, keputusan owner): SEMUA angka dihitung dalam
 * SATU query berbatas tanggal (generate_series + agregat FILTER) memakai
 * indeks idx_activity_log_author_created — tanpa mode legacy/unbounded.
 * Jendela di-clamp ≤366 hari; format salah → 400.
 */
export interface StatsRange {
  from: string;
  to: string;
}

export interface SemesterRef {
  semester: string;
  from: string;
  to: string;
}

const SEMESTER_RE = /^(\d{4})-H([12])$/;
const MAX_WINDOW_DAYS = 366;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Parse ?semester=YYYY-H[12] → rentang kalender Jan–Jun / Jul–Des. */
export function parseSemesterParam(raw: unknown): SemesterRef {
  const m = SEMESTER_RE.exec(typeof raw === 'string' ? raw : '');
  const year = m?.[1] !== undefined ? Number(m[1]) : NaN;
  const half = m?.[2];
  if (!Number.isInteger(year) || year < 1970 || year > 2100 || (half !== '1' && half !== '2')) {
    throw new ApiError(400, 'INVALID_SEMESTER', 'semester must be YYYY-H1 or YYYY-H2');
  }
  const from = half === '1' ? `${year}-01-01` : `${year}-07-01`;
  const to = half === '1' ? `${year}-06-30` : `${year}-12-31`;
  return { semester: `${year}-H${half}`, from, to };
}

/** Semester berjalan (default bila ?semester= absen). */
export function currentSemesterRef(now = new Date()): SemesterRef {
  const half = now.getMonth() < 6 ? '1' : '2';
  return parseSemesterParam(`${now.getFullYear()}-H${half}`);
}

export interface ActivityDay {
  date: string;
  count: number;
}

export interface UserStats {
  semester: string;
  from: string;
  to: string;
  totalContributions: number;
  taskCompletions: number;
  issuesResolved: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  days: ActivityDay[];
}

interface ScopedRow {
  date: string;
  count: number;
  tasks: number;
  issues: number;
}

export function computeStreaks(days: ActivityDay[]): {
  currentStreak: number;
  longestStreak: number;
} {
  let longest = 0;
  let run = 0;
  for (const day of days) {
    if (day.count > 0) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  // Current streak: berakhir hari ini; bila hari ini kosong, mundur ke kemarin.
  let current = 0;
  let i = days.length - 1;
  if (i >= 0 && days[i]!.count === 0) i -= 1;
  while (i >= 0 && days[i]!.count > 0) {
    current += 1;
    i -= 1;
  }

  return { currentStreak: current, longestStreak: longest };
}

export async function computeUserStats(userId: string, ref: SemesterRef): Promise<UserStats> {
  const range: StatsRange = ref;
  const fromDay = new Date(`${range.from}T00:00:00`);
  const toDay = new Date(`${range.to}T00:00:00`);
  const windowDays = Math.round((toDay.getTime() - fromDay.getTime()) / 86_400_000) + 1;
  if (!Number.isFinite(windowDays) || windowDays < 1 || windowDays > MAX_WINDOW_DAYS) {
    throw new ApiError(400, 'INVALID_RANGE', 'date range must span 1-366 days');
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (toDay.getTime() > today.getTime()) {
    throw new ApiError(400, 'INVALID_RANGE', 'range end cannot be in the future');
  }

  const scoped = await pool.query<ScopedRow>(
    `SELECT d::date::text AS date,
       COALESCE(a.count, 0)::int AS count,
       COALESCE(a.tasks, 0)::int AS tasks,
       COALESCE(a.issues, 0)::int AS issues
     FROM generate_series($2::date, $3::date, '1 day') AS d
     LEFT JOIN (
       SELECT created_at::date AS day,
         count(*)::int AS count,
         count(*) FILTER (
           WHERE entity = 'tasks' AND action = 'updated'
             AND changes @> '{"status":{"to":"done"}}'
         )::int AS tasks,
         count(*) FILTER (
           WHERE entity = 'issues' AND action = 'updated'
             AND changes @> '{"status":{"to":"resolved"}}'
         )::int AS issues
       FROM activity_log
       WHERE author_id = $1 AND created_at::date BETWEEN $2::date AND $3::date
       GROUP BY created_at::date
     ) a ON a.day = d
     ORDER BY d`,
    [userId, range.from, range.to],
  );

  const days: ActivityDay[] = scoped.rows.map((r) => ({ date: r.date, count: r.count }));

  const { currentStreak, longestStreak } = computeStreaks(days);

  return {
    semester: ref.semester,
    from: range.from,
    to: range.to,
    totalContributions: days.reduce((sum, d) => sum + d.count, 0),
    taskCompletions: scoped.rows.reduce((sum, r) => sum + r.tasks, 0),
    issuesResolved: scoped.rows.reduce((sum, r) => sum + r.issues, 0),
    activeDays: days.filter((d) => d.count > 0).length,
    currentStreak,
    longestStreak,
    days,
  };
}