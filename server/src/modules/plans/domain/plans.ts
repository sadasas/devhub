export type TeamPlan = 'free' | 'pro';

export const PLAN_LIMIT_CODE = 'PLAN_LIMIT';

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

export interface PlanLimitDetails {
  resource: 'projects' | 'members';
  limit: number;
}

/**
 * Helper B2: tentukan apakah target paket adalah downgrade dari limit efektif saat ini.
 * null = unlimited (infinity). Downgrade jika salah satu limit target < limit cur dan bukan same-type.
 * Dipakai di billingService untuk cabang renewal/upgrade/downgrade.
 */
export function isDowngrade(
  cur: { maxMembers: number | null; maxProjects: number | null },
  target: { max_members: number | null; max_projects: number | null } | { maxMembers: number | null; maxProjects: number | null },
): boolean {
  const curMembers = cur.maxMembers === null ? Infinity : cur.maxMembers;
  const curProjects = cur.maxProjects === null ? Infinity : cur.maxProjects;
  let targetMembers: number;
  let targetProjects: number;
  if ('max_members' in target) {
    const t = target as { max_members: number | null; max_projects: number | null };
    targetMembers = t.max_members === null ? Infinity : t.max_members;
    targetProjects = t.max_projects === null ? Infinity : t.max_projects;
  } else {
    const t = target as { maxMembers: number | null; maxProjects: number | null };
    targetMembers = t.maxMembers === null ? Infinity : t.maxMembers;
    targetProjects = t.maxProjects === null ? Infinity : t.maxProjects;
  }
  return targetMembers < curMembers || targetProjects < curProjects;
}
