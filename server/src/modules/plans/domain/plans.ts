export type TeamPlan = 'free' | 'pro';

export const PLAN_LIMIT_CODE = 'PLAN_LIMIT';

export interface TeamUsage {
  plan: TeamPlan;
  packageName: string;
  memberLimit: number | null;
  projectLimit: number | null;
  memberCount: number;
  projectCount: number;
}

export interface PlanLimitDetails {
  resource: 'projects' | 'members';
  limit: number;
}
