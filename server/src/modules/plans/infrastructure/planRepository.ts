import { pool } from '../../../db/pool.js';
import { withTransaction } from '../../../shared/db.js';
import type { TeamPlan } from '../domain/plans.js';

export interface TeamUsage {
  plan: TeamPlan;
  packageName: string;
  memberLimit: number | null;
  projectLimit: number | null;
  memberCount: number;
  projectCount: number;
  pendingPackageId?: string | null;
  pendingPackageName?: string | null;
  pendingDuration?: number | null;
  pendingCreatedAt?: Date | null;
  planExpiresAt?: Date | null;
}

/**
 * Limit efektif = paket terpasang pada tim selama masih aktif dan belum kedaluwarsa;
 * selain itu fallback ke paket Free (is_free, satu-satunya di tabel).
 * B1: lazy activation pending downgrade — tanpa cron.
 *  - WITH activated AS (UPDATE teams SET plan_package_id = plan_pending_package_id, plan_expires_at = now() + make_interval(days => plan_pending_duration), plan_pending_package_id=NULL, plan_pending_duration=NULL, plan_pending_created_at=NULL WHERE id=$1 AND plan_pending_package_id IS NOT NULL AND plan_expires_at IS NOT NULL AND plan_expires_at <= now() RETURNING *)
 *  - Jika plan_expires_at IS NULL (grant permanen) maka pending tidak diaktivasi (bypass untuk B2).
 *  Implementasi: 2 query sequential dalam satu transaksi agar SELECT melihat hasil UPDATE (WITH snapshot isolation tidak visible).
 */
export async function getTeamUsage(teamId: string): Promise<TeamUsage | null> {
  return withTransaction(pool, async (client) => {
    // Lazy activation: jika ada pending dan expiry sudah lewat (bukan permanen), jadwalkan jadi aktif sekarang.
    await client.query(
      `UPDATE teams
       SET plan_package_id = plan_pending_package_id,
           plan = COALESCE((SELECT CASE WHEN bp.is_free THEN 'free' ELSE 'pro' END FROM billing_packages bp WHERE bp.id = teams.plan_pending_package_id), plan),
           plan_duration_days = plan_pending_duration,
           plan_expires_at = now() + make_interval(days => plan_pending_duration),
           plan_pending_package_id = NULL,
           plan_pending_duration = NULL,
           plan_pending_created_at = NULL,
           updated_at = now()
       WHERE id = $1
         AND plan_pending_package_id IS NOT NULL
         AND plan_expires_at IS NOT NULL
         AND plan_expires_at <= now()`,
      [teamId],
    );

    const result = await client.query<TeamUsage>(
      `SELECT CASE WHEN cur.id IS NOT NULL THEN 'pro' ELSE 'free' END AS plan,
              COALESCE(cur.name, fr.name)                  AS "packageName",
              CASE WHEN cur.id IS NOT NULL THEN cur.max_members   ELSE fr.max_members   END AS "memberLimit",
              CASE WHEN cur.id IS NOT NULL THEN cur.max_projects  ELSE fr.max_projects  END AS "projectLimit",
              (SELECT count(*)::int FROM projects p WHERE p.team_id = t.id)     AS "projectCount",
              (SELECT count(*)::int FROM team_members tm WHERE tm.team_id = t.id) AS "memberCount",
              t.plan_pending_package_id AS "pendingPackageId",
              pend.name AS "pendingPackageName",
              t.plan_pending_duration AS "pendingDuration",
              t.plan_pending_created_at AS "pendingCreatedAt",
              t.plan_expires_at AS "planExpiresAt"
       FROM teams t
       LEFT JOIN billing_packages cur
         ON cur.id = t.plan_package_id
        AND (t.plan_expires_at IS NULL OR t.plan_expires_at > now())
       LEFT JOIN LATERAL (
         SELECT name, max_members, max_projects
         FROM billing_packages WHERE is_free LIMIT 1
       ) fr ON true
       LEFT JOIN billing_packages pend ON pend.id = t.plan_pending_package_id
       WHERE t.id = $1`,
      [teamId],
    );
    return result.rows[0] ?? null;
  });
}

export async function setTeamPlan(
  teamId: string,
  plan: TeamPlan,
  packageId?: string,
  durationDays?: number,
): Promise<{ id: string; plan: TeamPlan; planDurationDays: number | null } | null> {
  // Validasi paket jika pro dengan packageId spesifik
  let effectivePackageId: string | null = null;
  if (plan === 'pro' && packageId) {
    const pkgCheck = await pool.query<{ id: string }>(
      `SELECT id FROM billing_packages WHERE id = $1 AND is_active AND NOT is_free`,
      [packageId],
    );
    if (!pkgCheck.rows[0]) throw Object.assign(new Error('Invalid package'), { code: '400' });
    effectivePackageId = packageId;
  } else if (plan === 'pro') {
    const fallback = await pool.query<{ id: string }>(
      `SELECT id FROM billing_packages WHERE is_active AND NOT is_free ORDER BY sort_order, created_at LIMIT 1`,
    );
    effectivePackageId = fallback.rows[0]?.id ?? null;
  }

  // Snapshot histori + expiry atomik (1 sumber: duration -> expiry, keduanya tulis bersama)
  const durationVal = plan === 'pro' && durationDays ? durationDays : null;
  const expiry =
    plan === 'pro' && effectivePackageId && durationVal
      ? `GREATEST(COALESCE(plan_expires_at, now()), now()) + make_interval(days => ${durationVal})`
      : plan === 'pro' && effectivePackageId
        ? `GREATEST(COALESCE(plan_expires_at, now()), now()) + interval '30 days'`
        : 'NULL';

  console.log(expiry);


  // Jika pro dengan durasi, stacking; jika free, clear semua
  const result = await pool.query<{ id: string; plan: TeamPlan; plan_duration_days: number | null }>(
    `UPDATE teams SET
       plan = $2,
       plan_package_id = CASE WHEN $2 = 'pro' THEN $3::uuid ELSE NULL END,
       plan_duration_days = CASE WHEN $2 = 'pro' THEN $4::int ELSE NULL END,
       plan_expires_at = ${expiry}
     WHERE id = $1
     RETURNING id, plan, plan_duration_days`,
    [teamId, plan, effectivePackageId, durationVal],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, plan: row.plan, planDurationDays: row.plan_duration_days };
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
