import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TopBar } from './TopBar';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { canPlanAccessFeature } from '../services/planGating';
import { getSubscriptionState, getEffectivePlan } from '../services/subscriptionService';
import { getPendingApprovalsCountForUser } from '../services/approvalNotificationService';
import type { CompanyLanguageCode } from '../types';
import styles from './Layout.module.css';

const VALID_LOCALES: CompanyLanguageCode[] = ['en', 'tr', 'es', 'fr', 'de'];

export function Layout() {
  const { t, setLocale } = useI18n();
  const { user, company, profilesVersion } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [showPlanUpdateSuccess, setShowPlanUpdateSuccess] = useState(() => !!(location.state as { planChangeSuccess?: boolean } | null)?.planChangeSuccess);
  const sub = getSubscriptionState(company);
  const isPlanPage = location.pathname === '/plan';

  useEffect(() => {
    const state = location.state as { planChangeSuccess?: boolean } | null;
    if (state?.planChangeSuccess) setShowPlanUpdateSuccess(true);
  }, [location.state]);

  const dismissPlanSuccess = () => {
    setShowPlanUpdateSuccess(false);
    navigate(location.pathname, { replace: true, state: {} });
  };

  useEffect(() => {
    const code = company?.language_code;
    if (code && VALID_LOCALES.includes(code)) setLocale(code);
  }, [company?.language_code, setLocale]);
  const planAllowsDeliveryNotes = canPlanAccessFeature(getEffectivePlan(company), 'deliveryNotes');
  const canAccessDeliveryNotes = (user?.role === 'companyManager' || user?.role === 'projectManager') && planAllowsDeliveryNotes;
  const canAccessSettingsAndPayroll = user?.role === 'companyManager' || user?.role === 'projectManager';
  const canAccessAuditLogs = user?.role === 'companyManager';

  const companyId = user?.companyId ?? '';
  const pendingApprovalsCount = useMemo(
    () => getPendingApprovalsCountForUser(companyId, user ?? undefined),
    [companyId, user, profilesVersion]
  );
  const showApprovalsPending = pendingApprovalsCount > 0;

  return (
    <div className={styles.layout}>
      <TopBar pendingApprovalsCount={pendingApprovalsCount} />
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <NavLink to="/" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)} end>
              {t('nav.dashboard')}
            </NavLink>
            <NavLink to="/jobs" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
              {t('nav.jobEntry')}
            </NavLink>
            <NavLink to="/my-jobs" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
              {t('nav.myJobs')}
            </NavLink>
            <NavLink to="/management" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
              {t('topBar.managementPanel')}
            </NavLink>
            {canAccessDeliveryNotes && (
              <NavLink to="/delivery-notes" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
                {t('nav.deliveryNotes')}
              </NavLink>
            )}
            <NavLink
              to="/approvals"
              className={({ isActive }) =>
                isActive ? styles.linkActive : showApprovalsPending ? `${styles.link} ${styles.linkPending}` : styles.link
              }
            >
              {t('nav.approvals')}
            </NavLink>
            <NavLink to="/reports" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
              {t('nav.reports')}
            </NavLink>
            {canAccessSettingsAndPayroll && (
              <>
                <NavLink to="/settings" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
                  {t('nav.settings')}
                </NavLink>
                <NavLink to="/payroll" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
                  {t('nav.payrollPeriods')}
                </NavLink>
              </>
            )}
            {canAccessAuditLogs && (
              <NavLink to="/audit-logs" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
                {t('auditLogs.title')}
              </NavLink>
            )}
            {canAccessAuditLogs && (
              <NavLink to="/plan" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
                {t('planPage.title')}
              </NavLink>
            )}
          </nav>
        </aside>
        <main className={styles.main}>
          {showPlanUpdateSuccess && (
            <div className={styles.planUpdateBanner} role="status">
              <p>{t('planChangePage.planUpdateComplete')}</p>
              <button type="button" className={styles.planUpdateBannerClose} onClick={dismissPlanSuccess} aria-label={t('common.close')}>
                ×
              </button>
            </div>
          )}
          {sub.isClosed && !isPlanPage && (
            <div className={styles.subscriptionBannerClosed} role="alert">
              <p>{t('planPage.bannerClosedMessage')}</p>
              <NavLink to="/plan" className={styles.subscriptionBannerLink}>{t('planPage.title')}</NavLink>
            </div>
          )}
          {sub.isGracePeriod && !sub.isClosed && !isPlanPage && (
            <div className={styles.subscriptionBannerGrace} role="alert">
              <p>{t('planPage.bannerExpired')}</p>
              <NavLink to="/plan" className={styles.subscriptionBannerLink}>{t('planPage.title')}</NavLink>
            </div>
          )}
          {sub.isClosed && !isPlanPage ? null : (
            <>
              <Outlet />
              {sub.isGracePeriod && !isPlanPage && (
                <div className={styles.subscriptionOverlay} aria-hidden>
                  <div className={styles.subscriptionOverlayContent}>
                    <p>{t('planPage.bannerExpired')}</p>
                    <NavLink to="/plan" className={styles.subscriptionBannerLink}>{t('planPage.title')}</NavLink>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
