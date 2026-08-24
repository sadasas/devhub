import { ApiError } from '../../../shared/errors.js';
import {
  PLAN_LIMIT_CODE,
  type PlanLimitDetails,
  type TeamPlan,
  type TeamUsage,
} from '../domain/plans.js';
import {
  activateTeamPackage as repoActivateTeamPackage,
  getTeamUsage as repoGetTeamUsage,
  setTeamPlan as repoSetTeamPlan,
} from '../infrastructure/planRepository.js';

function assertWithinLimit(usage: TeamUsage, resource: 'projects' | 'members'): void {
  const limit = resource === 'projects' ? usage.projectLimit : usage.memberLimit;
  const count = resource === 'projects' ? usage.projectCount : usage.memberCount;
  // NULL = unlimited (paket premium).
  if (limit === null || count < limit) return;
  const message =
    resource === 'projects'
      ? `Your workspace has reached its ${limit}-project limit. Upgrade for more capacity.`
      : `Your workspace has reached its ${limit}-member limit. Upgrade for more capacity.`;
  throw new ApiError(402, PLAN_LIMIT_CODE, message, { resource, limit } satisfies PlanLimitDetails);
}

export async function assertProjectQuota(teamId: string): Promise<void> {
  const usage = await repoGetTeamUsage(teamId);
  if (!usage) return;
  assertWithinLimit(usage, 'projects');
}

export async function assertMemberQuota(teamId: string): Promise<void> {
  const usage = await repoGetTeamUsage(teamId);
  if (!usage) return;
  assertWithinLimit(usage, 'members');
}

/** Limit efektif dari DB + hitungan pemakaian, untuk konsumsi modul lain. */
export async function getEffectiveUsage(teamId: string): Promise<TeamUsage | null> {
  return repoGetTeamUsage(teamId);
}

/** Grant manual operator: attach paket dengan durasi opsional. */
export async function updateTeamPlan(
  teamId: string,
  plan: TeamPlan,
  packageId?: string,
  durationDays?: number,
): Promise<{ id: string; plan: TeamPlan } | null> {
  return repoSetTeamPlan(teamId, plan, packageId, durationDays);
}

/** Aktivasi paket hasil pembayaran; menumpuk dari expiry lama bila masih aktif. */
export async function activateTeamPackage(
  teamId: string,
  packageId: string,
  days: number,
): Promise<Date | null> {
  return repoActivateTeamPackage(teamId, packageId, days);
}
