import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { store } from '../data/store';
import { getPlanUserLimit, getPlanTeamLimit } from '../services/planGating';
import {
  getSubscriptionState,
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
  const userLimit = getPlanUserLimit(c?.plan);
  const teamLimit = getPlanTeamLimit(c?.plan);
  const userCount = store.getUsers(companyId).length;
  const teamCount = store.getTeams(companyId).length;

  const planStart = c?.plan_start_date ?? null;
  const planEnd = c?.plan_end_date ?? null;

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('planPage.title')}</h1>

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
          <p className={styles.planName}>{planLabel(c?.plan, t)}</p>
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

      {!sub.isClosed && (
        <div className={styles.upgradeBlock}>
          <Card title={t('planPage.upgradePlan')}>
            <p className={styles.upgradeDesc}>{t('planPage.upgradeDesc')}</p>
            <button type="button" className={styles.upgradeBtn} onClick={() => window.open('/workspace', '_blank')}>
              {t('planPage.upgradeButton')}
            </button>
          </Card>
        </div>
      )}

      {sub.isGracePeriod && (
        <p className={styles.graceNote}>
          {t('planPage.graceNote', { days: GRACE_PERIOD_DAYS })}
        </p>
      )}
    </div>
  );
}
