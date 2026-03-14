/**
 * Plan-based feature gating for MK-OPS SaaS.
 * Starter: 4 users, 3 teams. Professional: 7 users, 6 teams. Enterprise: 15 users, 14 teams.
 * Company Manager cannot be team leader; Project Managers can be assigned as team leaders.
 */

import type { CompanyPlan } from '../types';

export const PLAN_USER_LIMITS: Record<CompanyPlan, number> = {
  starter: 4,
  professional: 7,
  enterprise: 15,
};

/** Starter: 3 teams; Professional: 6 teams; Enterprise: 14 teams. */
export const PLAN_TEAM_LIMITS: Record<CompanyPlan, number> = {
  starter: 3,
  professional: 6,
  enterprise: 14,
};

export type PlanFeature = 'projects' | 'materials' | 'deliveryNotes';

const PLAN_FEATURES: Record<PlanFeature, Record<CompanyPlan, boolean>> = {
  projects: { starter: false, professional: true, enterprise: true },
  materials: { starter: false, professional: true, enterprise: true },
  deliveryNotes: { starter: false, professional: true, enterprise: true },
};

function normalizePlan(plan: CompanyPlan | null | undefined): CompanyPlan | null {
  if (plan && (plan === 'starter' || plan === 'professional' || plan === 'enterprise')) return plan;
  return null;
}

/** Maximum users allowed for the plan. */
export function getPlanUserLimit(plan: CompanyPlan | null | undefined): number {
  const p = normalizePlan(plan);
  return p ? PLAN_USER_LIMITS[p] : 0;
}

/** Whether the plan can access the feature (projects, materials, delivery notes). */
export function canPlanAccessFeature(
  plan: CompanyPlan | null | undefined,
  feature: PlanFeature
): boolean {
  const p = normalizePlan(plan);
  return p ? PLAN_FEATURES[feature][p] : false;
}

/** Whether the company can add one more user (currentCount is existing user count). */
export function canPlanAddUser(
  plan: CompanyPlan | null | undefined,
  currentUserCount: number
): boolean {
  const limit = getPlanUserLimit(plan);
  return limit === Infinity || currentUserCount < limit;
}

/** Maximum teams allowed for the plan (Starter = 3, Professional = 6, Enterprise = 14). */
export function getPlanTeamLimit(plan: CompanyPlan | null | undefined): number {
  const p = normalizePlan(plan);
  return p ? PLAN_TEAM_LIMITS[p] : 0;
}

/** Whether the company can add one more team (currentCount is existing team count). */
export function canPlanAddTeam(
  plan: CompanyPlan | null | undefined,
  currentTeamCount: number
): boolean {
  const limit = getPlanTeamLimit(plan);
  return limit === Infinity || currentTeamCount < limit;
}
