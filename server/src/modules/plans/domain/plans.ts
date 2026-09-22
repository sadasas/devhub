export type TeamPlan = 'free' | 'pro';

export const PLAN_LIMIT_CODE = 'PLAN_LIMIT';

export interface TeamUsage {
  plan: TeamPlan;
  packageName: string;
  memberLimit: number | null;
  projectLimit: number | null;
  /** Byte; null = unlimited, 0 = upload mati. */
  storageLimit: number | null;
  storageUsed: number;
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
  cur: { maxMembers: number | null; maxProjects: number | null; maxStorageBytes?: number | null },
  target:
    | { max_members: number | null; max_projects: number | null; max_storage_bytes?: number | null }
    | { maxMembers: number | null; maxProjects: number | null; maxStorageBytes?: number | null },
): boolean {
  const num = (v: number | null | undefined): number => (v === null || v === undefined ? Infinity : v);
  const curMembers = num(cur.maxMembers);
  const curProjects = num(cur.maxProjects);
  const curStorage = num(cur.maxStorageBytes);
  let targetMembers: number;
  let targetProjects: number;
  let targetStorage: number;
  if ('max_members' in target) {
    const t = target as { max_members: number | null; max_projects: number | null; max_storage_bytes?: number | null };
    targetMembers = num(t.max_members);
    targetProjects = num(t.max_projects);
    targetStorage = num(t.max_storage_bytes);
  } else {
    const t = target as { maxMembers: number | null; maxProjects: number | null; maxStorageBytes?: number | null };
    targetMembers = num(t.maxMembers);
    targetProjects = num(t.maxProjects);
    targetStorage = num(t.maxStorageBytes);
  }
  return targetMembers < curMembers || targetProjects < curProjects || targetStorage < curStorage;
}
