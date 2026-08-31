import { pool } from '../../../db/pool.js';
import { ApiError } from '../../../shared/errors.js';

export interface PlatformStats {
  users: number;
  teams: number;
  projects: number;
  activeKeys: number;
  activity24h: number;
  activity7d: number;
  revenue24h: number;
  revenue7d: number;
  revenueTotal: number;
  paidTeams: number;
  pendingPayments: number;
}

export interface AdminPayment {
  id: string;
  teamId: string;
  teamName: string;
  orderId: string;
  buyerEmail: string;
  packageName: string;
  durationDays: number | null;
  amount: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  role: string;
  teamCount: number;
  createdAt: string;
  lastActiveAt: string | null;
  plan: string | null;
  lastPaymentAmount: number | null;
  lastPaymentAt: string | null;
}

export interface AdminTeam {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  planPackageId: string | null;
  planDurationDays: number | null;
  planExpiresAt: string | null;
  ownerEmail: string | null;
  memberCount: number;
  projectCount: number;
  createdAt: string;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const result = await pool.query<PlatformStats>(`
    SELECT
      (SELECT count(*) FROM users)::int AS users,
      (SELECT count(*) FROM teams)::int AS teams,
      (SELECT count(*) FROM projects)::int AS projects,
      (SELECT count(*) FROM mcp_keys WHERE revoked_at IS NULL)::int AS "activeKeys",
      (SELECT count(*) FROM activity_log WHERE created_at >= now() - interval '24 hours')::int AS "activity24h",
      (SELECT count(*) FROM activity_log WHERE created_at >= now() - interval '7 days')::int AS "activity7d",
      (SELECT coalesce(sum(amount), 0)::int FROM team_payments WHERE status = 'completed' AND completed_at >= now() - interval '24 hours')::int AS "revenue24h",
      (SELECT coalesce(sum(amount), 0)::int FROM team_payments WHERE status = 'completed' AND completed_at >= now() - interval '7 days')::int AS "revenue7d",
      (SELECT coalesce(sum(amount), 0)::int FROM team_payments WHERE status = 'completed')::int AS "revenueTotal",
      (SELECT count(*)::int FROM teams t LEFT JOIN billing_packages cur ON cur.id = t.plan_package_id AND (t.plan_expires_at IS NULL OR t.plan_expires_at > now()) WHERE cur.id IS NOT NULL)::int AS "paidTeams",
      (SELECT count(*)::int FROM team_payments WHERE status = 'pending')::int AS "pendingPayments"
  `);
  const row = result.rows[0];
  if (!row) throw new ApiError(500, 'INTERNAL', 'Failed to compute platform stats');
  return row;
}

const USER_FILTER = `($1 = '' OR u.email ILIKE '%' || $1 || '%' OR u.display_name ILIKE '%' || $1 || '%')`;

export async function getPlatformStatsCharts(): Promise<{
  revenueByDay: Array<{ date: string; amount: number }>;
  revenueByPackage: Array<{ name: string; amount: number }>;
}> {
  const [byDay, byPackage] = await Promise.all([
    pool.query<{ date: string; amount: number }>(
      `SELECT to_char(completed_at, 'YYYY-MM-DD') AS date, sum(amount)::int AS amount
       FROM team_payments
       WHERE status = 'completed' AND completed_at >= now() - interval '30 days'
       GROUP BY 1
       ORDER BY 1`,
    ),
    pool.query<{ name: string; amount: number }>(
      `SELECT package_name AS name, sum(amount)::int AS amount
       FROM team_payments
       WHERE status = 'completed'
       GROUP BY 1
       ORDER BY 2 DESC`,
    ),
  ]);
  return {
    revenueByDay: byDay.rows,
    revenueByPackage: byPackage.rows,
  };
}

const ACTIVITY_DEFAULT = {
  trunc: 'day', fmt: 'YYYY-MM-DD', labelFmt: 'Dy', steps: 7, step: '1 day',
};

const ACTIVITY_CONFIG: Record<string, { trunc: string; fmt: string; labelFmt: string; steps: number; step: string }> = {
  '1d':  { trunc: 'hour',  fmt: 'HH24:00',                    labelFmt: 'HH24:00', steps: 24, step: '1 hour' },
  '7d':  { trunc: 'day',   fmt: 'YYYY-MM-DD',                 labelFmt: 'Dy',     steps: 7,  step: '1 day' },
  '1m':  { trunc: 'day',   fmt: 'YYYY-MM-DD',                 labelFmt: 'DD Mon', steps: 30, step: '1 day' },
  '6m':  { trunc: 'week',  fmt: 'YYYY-MM-DD',                 labelFmt: 'DD Mon', steps: 26, step: '1 week' },
  '12m': { trunc: 'month', fmt: 'YYYY-MM',                    labelFmt: 'Mon YYYY', steps: 12, step: '1 month' },
};

export async function getActivityByRange(
  range: string,
): Promise<{ date: string; label: string; count: number }[]> {
  const cfg = ACTIVITY_CONFIG[range] ?? ACTIVITY_DEFAULT;
  const { trunc, fmt, labelFmt, steps, step } = cfg;
  const result = await pool.query<{ date: string; label: string; count: number }>(
    `SELECT to_char(date_trunc('${trunc}', d), '${fmt}') AS date,
            to_char(date_trunc('${trunc}', d), '${labelFmt}') AS label,
            COALESCE(count(a.id), 0)::int AS count
     FROM generate_series(
            date_trunc('${trunc}', now()) - interval '${step}' * ${steps - 1},
            date_trunc('${trunc}', now()),
            interval '${step}'
          ) d
     LEFT JOIN activity_log a ON date_trunc('${trunc}', a.created_at) = d
     GROUP BY d
     ORDER BY d`,
  );
  return result.rows;
}

export async function listPlatformUsers(
  query: string,
  limit: number,
  offset: number,
  planFilter?: string,
): Promise<{ users: AdminUser[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (query) {
    conditions.push(`(u.email ILIKE '%' || $${idx} || '%' OR u.display_name ILIKE '%' || $${idx} || '%')`);
    params.push(query);
    idx++;
  }

  if (planFilter && (planFilter === 'free' || planFilter === 'pro')) {
    conditions.push(`EXISTS (SELECT 1 FROM team_members tm2 JOIN teams t2 ON t2.id = tm2.team_id WHERE tm2.user_id = u.id AND t2.plan = $${idx})`);
    params.push(planFilter);
    idx++;
  } else if (planFilter && planFilter === 'paid') {
    conditions.push(`EXISTS (SELECT 1 FROM team_members tm2 JOIN teams t2 ON t2.id = tm2.team_id WHERE tm2.user_id = u.id AND t2.plan = 'pro')`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [list, total] = await Promise.all([
    pool.query<AdminUser>(
      `SELECT u.id, u.email, u.display_name AS "displayName", u.avatar_url AS "avatarUrl", u.role, u.created_at AS "createdAt",
              (SELECT count(*)::int FROM team_members tm WHERE tm.user_id = u.id) AS "teamCount",
              (SELECT max(a.created_at) FROM activity_log a WHERE a.author_id = u.id) AS "lastActiveAt",
              (SELECT max(t.plan) FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id = u.id) AS "plan",
              (SELECT tp.amount FROM team_payments tp WHERE tp.created_by = u.id AND tp.status = 'completed' ORDER BY tp.completed_at DESC LIMIT 1) AS "lastPaymentAmount",
              (SELECT tp.completed_at FROM team_payments tp WHERE tp.created_by = u.id AND tp.status = 'completed' ORDER BY tp.completed_at DESC LIMIT 1) AS "lastPaymentAt"
       FROM users u
       ${where}
       ORDER BY u.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    ),
    pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM users u ${where}`,
      params,
    ),
  ]);
  return { users: list.rows, total: total.rows[0]?.total ?? 0 };
}

export async function setUserRole(
  actorId: string,
  targetUserId: string,
  role: 'user' | 'admin',
): Promise<{ id: string; email: string; role: string }> {
  if (actorId === targetUserId && role === 'user') {
    throw new ApiError(409, 'CONFLICT', 'You cannot demote yourself');
  }
  const result = await pool.query<{ id: string; email: string; role: string }>(
    `UPDATE users SET role = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, email, role`,
    [targetUserId, role],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return row;
}

export async function listPlatformTeams(limit: number): Promise<{ teams: AdminTeam[] }> {
  const result = await pool.query<AdminTeam>(
    `SELECT
            CASE WHEN cur.id IS NOT NULL THEN 'pro' ELSE 'free' END AS "plan",
            t.id, t.name,
            t.plan_package_id AS "planPackageId",
            t.plan_duration_days AS "planDurationDays",
            t.plan_expires_at AS "planExpiresAt",
            t.created_at AS "createdAt",
            (SELECT count(*)::int FROM team_members tm WHERE tm.team_id = t.id) AS "memberCount",
            (SELECT count(*)::int FROM projects p WHERE p.team_id = t.id) AS "projectCount",
            (SELECT u.email FROM team_members tm JOIN users u ON u.id = tm.user_id
             WHERE tm.team_id = t.id AND tm.role = 'owner' LIMIT 1) AS "ownerEmail"
     FROM teams t
     LEFT JOIN billing_packages cur ON cur.id = t.plan_package_id AND (t.plan_expires_at IS NULL OR t.plan_expires_at > now())
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return { teams: result.rows };
}

export async function listAllPayments(
  limit: number,
  offset: number,
  status?: string,
  teamId?: string,
): Promise<{ payments: AdminPayment[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (status && (status === 'pending' || status === 'completed')) {
    conditions.push(`tp.status = $${idx}`);
    params.push(status);
    idx++;
  }
  if (teamId) {
    conditions.push(`tp.team_id = $${idx}`);
    params.push(teamId);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [list, total] = await Promise.all([
    pool.query<AdminPayment>(
      `SELECT tp.id, tp.team_id AS "teamId", t.name AS "teamName",
              tp.order_id AS "orderId", u.email AS "buyerEmail",
              tp.package_name AS "packageName", tp.duration_days AS "durationDays",
              tp.amount, tp.status, tp.created_at AS "createdAt",
              tp.completed_at AS "completedAt"
       FROM team_payments tp
       JOIN teams t ON t.id = tp.team_id
       JOIN users u ON u.id = tp.created_by
       ${where}
       ORDER BY tp.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    ),
    pool.query<{ total: number }>(
      `SELECT count(*)::int AS total
       FROM team_payments tp
       JOIN teams t ON t.id = tp.team_id
       JOIN users u ON u.id = tp.created_by
       ${where}`,
      params,
    ),
  ]);
  return { payments: list.rows, total: total.rows[0]?.total ?? 0 };
}
