/**
 * Subscription / plan state: active, suspended (grace), closed.
 * Grace period = 15 days after plan_end_date. Data is never auto-deleted; only access is blocked.
 *
 * Plan change rules:
 * - Upgrade (higher plan): effective immediately. Set plan, plan_start_date = now, plan_end_date = now + period; clear pending_plan.
 * - Downgrade (lower plan): effective at end of current period. Set pending_plan (and pending_plan_billing_cycle).
 *   Current (higher) plan stays active until plan_end_date; then pending_plan is applied (via apply_pending_plan_if_due).
 */

import type { CompanyPlan } from '../types';

export const GRACE_PERIOD_DAYS = 15;

const PLAN_ORDER: Record<string, number> = { starter: 0, professional: 1, enterprise: 2 };

export type CompanyPlanLike = 'starter' | 'professional' | 'enterprise' | null | undefined;

/** True if newPlan is higher tier than currentPlan. */
export function isPlanUpgrade(currentPlan: CompanyPlanLike, newPlan: CompanyPlanLike): boolean {
  const c = currentPlan && PLAN_ORDER[currentPlan] !== undefined ? PLAN_ORDER[currentPlan] : -1;
  const n = newPlan && PLAN_ORDER[newPlan] !== undefined ? PLAN_ORDER[newPlan] : -1;
  return n > c;
}

/** True if newPlan is lower tier than currentPlan. */
export function isPlanDowngrade(currentPlan: CompanyPlanLike, newPlan: CompanyPlanLike): boolean {
  const c = currentPlan && PLAN_ORDER[currentPlan] !== undefined ? PLAN_ORDER[currentPlan] : -1;
  const n = newPlan && PLAN_ORDER[newPlan] !== undefined ? PLAN_ORDER[newPlan] : -1;
  return n < c;
}

const VALID_PLANS: CompanyPlan[] = ['starter', 'professional', 'enterprise'];

function isCompanyPlan(s: string | null | undefined): s is CompanyPlan {
  return s != null && VALID_PLANS.includes(s as CompanyPlan);
}

/** Plan to use for limits/features: current plan until period end; after plan_end_date with pending_plan set, use pending_plan. */
export function getEffectivePlan(company: {
  plan?: string | null;
  pending_plan?: string | null;
  plan_end_date?: string | null;
} | undefined): CompanyPlan | null {
  if (!company) return null;
  const planEnd = parseDate(company.plan_end_date ?? null);
  if (isCompanyPlan(company.pending_plan) && planEnd && new Date() >= planEnd) return company.pending_plan;
  return isCompanyPlan(company.plan) ? company.plan : null;
}

export type SubscriptionStatus = 'active' | 'suspended' | 'closed';

export type SubscriptionState = {
  status: SubscriptionStatus;
  /** Plan end datetime (ISO). */
  planEndDate: string | null;
  /** Suspension date = plan_end_date + 15 days (ISO). */
  suspensionDate: string | null;
  /** Days left until plan end (negative if expired). */
  remainingDays: number | null;
  /** Days left in grace period (only when status === 'suspended'). */
  graceRemainingDays: number | null;
  isExpired: boolean;
  isGracePeriod: boolean;
  isClosed: boolean;
  /** Whether any operational action should be disabled (suspended or closed). */
  isOperationsDisabled: boolean;
};

function parseDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Derives subscription state from company.
 * If subscription_status is explicitly 'closed', always closed.
 * Otherwise: now > plan_end_date + 15 days => closed; now > plan_end_date => suspended (grace); else active.
 * When plan exists but plan_end_date is missing (e.g. company created before dates existed), use createdAt + 1 month as end.
 */
export function getSubscriptionState(company: { plan_end_date?: string | null; subscription_status?: string | null; plan?: string | null; createdAt?: string | null } | undefined): SubscriptionState {
  const closedByAdmin = company?.subscription_status === 'closed';
  let planEnd = parseDate(company?.plan_end_date ?? null);
  if (!planEnd && company?.plan && company?.createdAt) {
    const start = parseDate(company.createdAt);
    if (start) {
      planEnd = new Date(start);
      planEnd.setDate(planEnd.getDate() + 30);
    }
  }
  const now = new Date();

  if (closedByAdmin) {
    return {
      status: 'closed',
      planEndDate: company?.plan_end_date ?? null,
      suspensionDate: null,
      remainingDays: null,
      graceRemainingDays: null,
      isExpired: true,
      isGracePeriod: false,
      isClosed: true,
      isOperationsDisabled: true,
    };
  }

  if (!planEnd) {
    return {
      status: 'active',
      planEndDate: null,
      suspensionDate: null,
      remainingDays: null,
      graceRemainingDays: null,
      isExpired: false,
      isGracePeriod: false,
      isClosed: false,
      isOperationsDisabled: false,
    };
  }

  const suspensionDate = new Date(planEnd);
  suspensionDate.setDate(suspensionDate.getDate() + GRACE_PERIOD_DAYS);

  const remainingMs = planEnd.getTime() - now.getTime();
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  if (now >= suspensionDate) {
    return {
      status: 'closed',
      planEndDate: planEnd.toISOString(),
      suspensionDate: suspensionDate.toISOString(),
      remainingDays,
      graceRemainingDays: null,
      isExpired: true,
      isGracePeriod: false,
      isClosed: true,
      isOperationsDisabled: true,
    };
  }

  if (now >= planEnd) {
    const graceRemainingMs = suspensionDate.getTime() - now.getTime();
    const graceRemainingDays = Math.ceil(graceRemainingMs / (24 * 60 * 60 * 1000));
    return {
      status: 'suspended',
      planEndDate: planEnd.toISOString(),
      suspensionDate: suspensionDate.toISOString(),
      remainingDays,
      graceRemainingDays,
      isExpired: true,
      isGracePeriod: true,
      isClosed: false,
      isOperationsDisabled: true,
    };
  }

  return {
    status: 'active',
    planEndDate: planEnd.toISOString(),
    suspensionDate: suspensionDate.toISOString(),
    remainingDays,
    graceRemainingDays: null,
    isExpired: false,
    isGracePeriod: false,
    isClosed: false,
    isOperationsDisabled: false,
  };
}

/** Format date for display (e.g. "20 March 12:00"). */
export function formatPlanEndDisplay(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** 72 hours in ms; red plan warning is shown when this much or less remains. */
export const PLAN_EXPIRY_WARNING_HOURS = 72;
const PLAN_EXPIRY_WARNING_MS = PLAN_EXPIRY_WARNING_HOURS * 60 * 60 * 1000;

export type PlanExpiryWarning = { remainingMs: number };

export type PlanWarningState =
  | { kind: 'expiring_soon'; remainingMs: number }
  | { kind: 'suspended'; graceRemainingDays: number }
  | { kind: 'closed' };

/**
 * Returns plan warning state for the red top-bar button.
 * - expiring_soon: plan ends in 72 hours or less (show countdown).
 * - suspended: plan expired, in 15-day grace (no data lost; can't process new data; show grace countdown).
 * - closed: after grace period (still show "renew" CTA).
 * Warning stays until plan is renewed; clicking the red button always goes to plan-and-payment.
 */
export function getPlanWarningState(company: {
  plan_end_date?: string | null;
  subscription_status?: string | null;
  plan?: string | null;
  createdAt?: string | null;
} | undefined): PlanWarningState | null {
  const state = getSubscriptionState(company);
  if (state.status === 'closed') return { kind: 'closed' };
  if (state.isGracePeriod && state.graceRemainingDays != null) {
    return { kind: 'suspended', graceRemainingDays: state.graceRemainingDays };
  }
  if (state.planEndDate && state.remainingDays != null && !state.isExpired) {
    const planEnd = parseDate(state.planEndDate);
    if (planEnd) {
      const remainingMs = planEnd.getTime() - Date.now();
      if (remainingMs > 0 && remainingMs <= PLAN_EXPIRY_WARNING_MS) {
        return { kind: 'expiring_soon', remainingMs };
      }
    }
  }
  return null;
}

/**
 * Returns plan expiry warning when plan ends in 72 hours or less (and not yet expired).
 * @deprecated Prefer getPlanWarningState for full warning (expiring + suspended + closed).
 */
export function getPlanExpiryWarning(company: { plan_end_date?: string | null } | undefined): PlanExpiryWarning | null {
  const s = getPlanWarningState(company);
  if (s?.kind === 'expiring_soon') return { remainingMs: s.remainingMs };
  return null;
}

/** Format remaining time for plan expiry warning: "2 days 22 hours left" or "5 hours left". */
export function formatPlanExpiryRemaining(remainingMs: number): { days: number; hours: number } {
  const totalHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return { days, hours };
}
