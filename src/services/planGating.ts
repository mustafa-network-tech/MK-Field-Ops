/**
 * Plan-based feature gating for MK-OPS SaaS.
 * Starter (3 users), Professional (9 users), Enterprise (unlimited).
 * Feature access and user limits are enforced across the app.
 */

import type { CompanyPlan } from '../types';

export const PLAN_USER_LIMITS: Record<CompanyPlan, number> = {
  starter: 3,
  professional: 9,
  enterprise: Infinity,
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
