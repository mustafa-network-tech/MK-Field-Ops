/**
 * Subscription / plan state: active, suspended (grace), closed.
 * Grace period = 15 days after plan_end_date. Data is never auto-deleted; only access is blocked.
 */

export const GRACE_PERIOD_DAYS = 15;

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
 */
export function getSubscriptionState(company: { plan_end_date?: string | null; subscription_status?: string | null } | undefined): SubscriptionState {
  const closedByAdmin = company?.subscription_status === 'closed';
  const planEnd = parseDate(company?.plan_end_date ?? null);
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
