import { pool } from '../../../db/pool.js';
import type { TeamPlan } from '../domain/plans.js';

export interface TeamUsage {
  plan: TeamPlan;
  packageName: string;
  memberLimit: number | null;
  projectLimit: number | null;
  memberCount: number;
  projectCount: number;
}

/**
 * Limit efektif = paket terpasang pada tim selama masih aktif dan belum kedaluwarsa;
 * selain itu fallback ke paket Free (is_free, satu-satunya di tabel).
 */
export async function getTeamUsage(teamId: string): Promise<TeamUsage | null> {
  const result = await pool.query<TeamUsage>(
    `SELECT CASE WHEN cur.id IS NOT NULL THEN 'pro' ELSE 'free' END AS plan,
            COALESCE(cur.name, fr.name)                  AS "packageName",
            CASE WHEN cur.id IS NOT NULL THEN cur.max_members   ELSE fr.max_members   END AS "memberLimit",
            CASE WHEN cur.id IS NOT NULL THEN cur.max_projects  ELSE fr.max_projects  END AS "projectLimit",
            (SELECT count(*)::int FROM projects p WHERE p.team_id = t.id)     AS "projectCount",
            (SELECT count(*)::int FROM team_members tm WHERE tm.team_id = t.id) AS "memberCount"
     FROM teams t
     LEFT JOIN billing_packages cur
       ON cur.id = t.plan_package_id
      AND (t.plan_expires_at IS NULL OR t.plan_expires_at > now())
     LEFT JOIN LATERAL (
       SELECT name, max_members, max_projects
       FROM billing_packages WHERE is_free LIMIT 1
     ) fr ON true
     WHERE t.id = $1`,
    [teamId],
  );
  return result.rows[0] ?? null;
}

export async function setTeamPlan(
  teamId: string,
  plan: TeamPlan,
  packageId?: string,
  durationDays?: number,
): Promise<{ id: string; plan: TeamPlan } | null> {
  const pkgId = packageId ?? null;
  const expiry =
    plan === 'pro' && pkgId && durationDays
      ? `now() + make_interval(days => ${durationDays})`
      : 'NULL';
  const result = await pool.query<{ id: string; plan: TeamPlan }>(
    `UPDATE teams SET
       plan = $2,
       plan_package_id = CASE WHEN $2 = 'pro' THEN (
         SELECT id FROM billing_packages WHERE is_active AND NOT is_free
         ORDER BY sort_order, created_at LIMIT 1
       ) ELSE NULL END,
       plan_expires_at = ${expiry}
     WHERE id = $1
     RETURNING id, plan`,
    [teamId, plan],
  );
  return result.rows[0] ?? null;
}

export async function activateTeamPackage(
  teamId: string,
  packageId: string,
  days: number,
): Promise<Date | null> {
  // Perpanjangan menumpuk dari expiry lama bila masih aktif; dari sekarang bila sudah lewat.
  const result = await pool.query<{ plan_expires_at: Date }>(
    `UPDATE teams
     SET plan = 'pro',
         plan_package_id = $2,
         plan_expires_at = GREATEST(COALESCE(plan_expires_at, now()), now()) + make_interval(days => $3)
     WHERE id = $1
     RETURNING plan_expires_at`,
    [teamId, packageId, days],
  );
  return result.rows[0]?.plan_expires_at ?? null;
}
