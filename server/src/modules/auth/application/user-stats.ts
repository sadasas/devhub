import { pool } from '../../../db/pool.js';

/**
 * Statistik profil gaya GitHub (ADR-039): agregasi per-user dari
 * activity_log (author_id dicap server, bukan client-supplied).
 * Catatan: aktivitas di-prune (500/project, 50/entity) sehingga angka
 * mencerminkan aktivitas terbaru, bukan audit all-time yang presisi.
 */
export const STATS_DAYS = 365;

export interface ActivityDay {
  date: string;
  count: number;
}

export interface UserStats {
  totalContributions: number;
  taskCompletions: number;
  issuesResolved: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  days: ActivityDay[];
}

interface DailyRow {
  date: string;
  count: number;
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

export async function computeUserStats(userId: string): Promise<UserStats> {
  const daily = await pool.query<DailyRow>(
    `SELECT d::date::text AS date, COALESCE(a.count, 0) AS count
     FROM generate_series(now()::date - $2::int + 1, now()::date, '1 day') AS d
     LEFT JOIN (
       SELECT created_at::date AS day, count(*)::int AS count
       FROM activity_log
       WHERE author_id = $1
         AND created_at >= now() - make_interval(days => $2)
       GROUP BY created_at::date
     ) a ON a.day = d
     ORDER BY d`,
    [userId, STATS_DAYS],
  );

  const days: ActivityDay[] = daily.rows.map((r) => ({ date: r.date, count: r.count }));

  const [tasks, issues] = await Promise.all([
    pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM activity_log
       WHERE author_id = $1 AND entity = 'tasks' AND action = 'updated'
         AND changes @> '{"status":{"to":"done"}}'`,
      [userId],
    ),
    pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM activity_log
       WHERE author_id = $1 AND entity = 'issues' AND action = 'updated'
         AND changes @> '{"status":{"to":"resolved"}}'`,
      [userId],
    ),
  ]);

  const { currentStreak, longestStreak } = computeStreaks(days);

  return {
    totalContributions: days.reduce((sum, d) => sum + d.count, 0),
    taskCompletions: tasks.rows[0]?.count ?? 0,
    issuesResolved: issues.rows[0]?.count ?? 0,
    activeDays: days.filter((d) => d.count > 0).length,
    currentStreak,
    longestStreak,
    days,
  };
}