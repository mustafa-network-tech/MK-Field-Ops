import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getPlanUserLimit, getPlanTeamLimit, planApprovedSeatCount } from '../services/planGating';
import {
  getSubscriptionState,
  getEffectivePlan,
  formatPlanEndDisplay,
  GRACE_PERIOD_DAYS,
} from '../services/subscriptionService';
import { Card } from '../components/ui/Card';
import styles from './Plan.module.css';

function planLabel(plan: string | null | undefined, t: (k: string) => string): string {
  if (plan === 'starter') return t('landing.planStarter');
  if (plan === 'professional') return t('landing.planPro');
  if (plan === 'enterprise') return t('landing.planEnterprise');
  return plan ?? '—';
}

function formatDateOnly(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function Plan() {
  const { t, locale } = useI18n();
  const { user, company } = useApp();

  if (user?.role !== 'companyManager') {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{t('planPage.title')}</h1>
        <p className={styles.muted}>{t('errors.forbidden')}</p>
      </div>
    );
  }

  const companyId = company?.id ?? user?.companyId ?? '';
  const c = store.getCompany(companyId, companyId) ?? company;
  const sub = getSubscriptionState(c);
  const effectivePlan = getEffectivePlan(c);
  const userLimit = getPlanUserLimit(effectivePlan);
  const teamLimit = getPlanTeamLimit(effectivePlan);
  const userCount = planApprovedSeatCount(store.getUsers(companyId));
  const teamCount = store.getTeams(companyId).length;

  const planStart = c?.plan_start_date ?? c?.createdAt ?? null;
  const planEnd = (() => {
    if (c?.plan_end_date) return c.plan_end_date;
    if (c?.createdAt && c?.plan) {
      const d = new Date(c.createdAt);
      d.setDate(d.getDate() + 30);
      return d.toISOString();
    }
    return null;
  })();

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          {t('planPage.title')}
          {effectivePlan && (
            <span className={styles.planBadge}> ({planLabel(effectivePlan, t)})</span>
          )}
        </h1>
        {!sub.isClosed && (
          <button type="button" className={styles.upgradeBtn} onClick={() => { window.location.href = '/plan-and-payment'; }}>
            {t('planPage.changePlanButton')}
          </button>
        )}
      </div>

      {/* Expired / Grace / Closed warnings */}
      {sub.isClosed && (
        <div className={styles.bannerClosed} role="alert">
          <p className={styles.bannerTitle}>{t('planPage.bannerClosedTitle')}</p>
          <p>{t('planPage.bannerClosedMessage')}</p>
        </div>
      )}
      {sub.isGracePeriod && (
        <div className={styles.bannerGrace} role="alert">
          <p className={styles.bannerTitle}>{t('planPage.bannerGraceTitle')}</p>
          <p>{t('planPage.bannerGraceMessage', { expiredDate: formatDateTime(sub.planEndDate, locale), suspensionDate: formatDateTime(sub.suspensionDate, locale) })}</p>
          <p className={styles.bannerMeta}>{t('planPage.bannerGraceCountdown', { days: sub.graceRemainingDays ?? 0 })}</p>
        </div>
      )}
      {sub.status === 'active' && sub.isExpired === false && sub.remainingDays !== null && sub.remainingDays <= 7 && sub.remainingDays > 0 && (
        <div className={styles.bannerWarning}>
          <p>{t('planPage.bannerExpiringSoon', { days: sub.remainingDays })}</p>
        </div>
      )}

      <div className={styles.grid}>
        <Card title={t('planPage.currentPlan')}>
          <p className={styles.planName}>{planLabel(effectivePlan ?? c?.plan, t)}</p>
          {c?.pending_plan && planEnd && new Date() < new Date(planEnd) && (
            <p className={styles.pendingPlanNote}>
              {t('planPage.pendingPlanNote', {
                plan: planLabel(c.pending_plan, t),
                date: formatDateOnly(planEnd, locale),
              })}
            </p>
          )}
          <ul className={styles.metaList}>
            <li>{t('planPage.planStart')}: {formatDateOnly(planStart, locale)}</li>
            <li>{t('planPage.planEnd')}: {formatDateOnly(planEnd, locale)}</li>
            <li>{t('planPage.remainingDays')}: {sub.remainingDays != null ? (sub.remainingDays > 0 ? sub.remainingDays : 0) : '—'}</li>
            <li>{t('planPage.expiresAt')}: {formatPlanEndDisplay(planEnd ?? null, locale)}</li>
          </ul>
        </Card>

        <Card title={t('planPage.usage')}>
          <p className={styles.usageRow}>
            <span>{t('planPage.users')}</span>
            <strong>{userCount} / {userLimit === Infinity ? '∞' : userLimit}</strong>
          </p>
          <p className={styles.usageRow}>
            <span>{t('planPage.teams')}</span>
            <strong>{teamCount} / {teamLimit === Infinity ? '∞' : teamLimit}</strong>
          </p>
        </Card>

        <Card title={t('planPage.billing')}>
          <ul className={styles.metaList}>
            <li>{t('planPage.planStart')}: {formatDateOnly(planStart, locale)}</li>
            <li>{t('planPage.planEnd')}: {formatDateOnly(planEnd, locale)}</li>
            <li>{t('planPage.remainingDays')}: {sub.remainingDays != null ? (sub.remainingDays > 0 ? sub.remainingDays : 0) : '—'}</li>
          </ul>
        </Card>
      </div>

      {sub.isGracePeriod && (
        <p className={styles.graceNote}>
          {t('planPage.graceNote', { days: GRACE_PERIOD_DAYS })}
        </p>
      )}
    </div>
  );
}
