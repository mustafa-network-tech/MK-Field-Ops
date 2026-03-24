import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { TopBar } from './TopBar';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { updateCompanyLanguageInSupabase } from '../services/companyService';
import { pushCompanyDataToSupabase } from '../services/supabaseSyncService';
import { canPlanAccessFeature } from '../services/planGating';
import { getSubscriptionState, getEffectivePlan } from '../services/subscriptionService';
import { getPendingApprovalsCountForUser } from '../services/approvalNotificationService';
import type { CompanyLanguageCode } from '../types';
import styles from './Layout.module.css';

const VALID_LOCALES: CompanyLanguageCode[] = ['en', 'tr', 'es', 'fr', 'de'];

export function Layout() {
  const { t, locale, setLocale } = useI18n();
  const { user, setUser, company, refreshCompany, profilesVersion } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPlanUpdateSuccess, setShowPlanUpdateSuccess] = useState(() => !!(location.state as { planChangeSuccess?: boolean } | null)?.planChangeSuccess);
  const sub = getSubscriptionState(company);
  const isPlanPage = location.pathname === '/plan' || location.pathname === '/plan-and-payment';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (companyId) {
        pushCompanyDataToSupabase(companyId).catch(() => {});
      }
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [companyId]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    authService.logout();
    setUser(undefined);
    navigate('/login');
  };

  const handleLocaleChange = async (loc: CompanyLanguageCode) => {
    setLocale(loc);
    if (user?.companyId) {
      await updateCompanyLanguageInSupabase(user.companyId, loc);
      refreshCompany();
    }
  };

  return (
    <div className={styles.layout}>
      <TopBar pendingApprovalsCount={pendingApprovalsCount} />
      <button
        type="button"
        className={styles.mobileMenuBtn}
        onClick={() => setSidebarOpen(true)}
        aria-label={t('layout.openMenu')}
      >
        <span className={styles.mobileMenuIcon} aria-hidden>☰</span>
      </button>
      {sidebarOpen && (
        <div className={styles.sidebarBackdrop} onClick={() => setSidebarOpen(false)} aria-hidden />
      )}
      <div className={styles.body}>
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>{t('layout.menu')}</span>
            <button type="button" className={styles.sidebarClose} onClick={() => setSidebarOpen(false)} aria-label={t('common.close')}>×</button>
          </div>
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
              <NavLink to="/plan-and-payment" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
                {t('planPage.title')}
              </NavLink>
            )}
          </nav>
          <div className={styles.sidebarFooter}>
            <div className={styles.sidebarLang}>
              <span className={styles.sidebarLangLabel}>{t('topBar.language')}</span>
              <div className={styles.sidebarLangButtons}>
                {VALID_LOCALES.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    className={locale === loc ? styles.sidebarLangBtnActive : styles.sidebarLangBtn}
                    onClick={() => handleLocaleChange(loc)}
                  >
                    {loc.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <NavLink to="/reports" className={styles.sidebarExportLink} onClick={() => setSidebarOpen(false)}>
              {t('common.export')}
            </NavLink>
            <button type="button" className={styles.sidebarLogoutBtn} onClick={handleLogout}>
              {t('auth.logout')}
            </button>
          </div>
        </aside>
        <main className={styles.main}>
          {!isOnline && (
            <div className={styles.offlineBanner} role="status" aria-live="polite">
              <h2 className={styles.offlineTitle}>{t('offline.title')}</h2>
              <p className={styles.offlineMessage}>{t('offline.message')}</p>
            </div>
          )}
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
              <NavLink to="/plan-and-payment" className={styles.subscriptionBannerLink}>{t('planPage.title')}</NavLink>
            </div>
          )}
          {isOnline && sub.isGracePeriod && !sub.isClosed && !isPlanPage && (
            <div className={styles.subscriptionBannerGrace} role="alert">
              <p>{t('planPage.bannerExpired')}</p>
              <NavLink to="/plan-and-payment" className={styles.subscriptionBannerLink}>{t('planPage.title')}</NavLink>
            </div>
          )}
          {sub.isClosed && !isPlanPage ? null : (
            <>
              <Outlet />
              {sub.isGracePeriod && !isPlanPage && (
                <div className={styles.subscriptionOverlay} aria-hidden>
                  <div className={styles.subscriptionOverlayContent}>
                    <p>{t('planPage.bannerExpired')}</p>
                    <NavLink to="/plan-and-payment" className={styles.subscriptionBannerLink}>{t('planPage.title')}</NavLink>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <footer className={styles.panelFooter}>
        <span className={styles.panelFooterLeft}>{t('layout.footerDevelopedBy')}</span>
        <div className={styles.panelFooterCenter}>
          <img src="/landing-logo.png" alt="MK" className={styles.panelFooterLogo} />
        </div>
        <a
          href="mailto:mustafa82oner@gmail.com"
          className={styles.panelFooterMail}
          title={t('layout.supportEmailTitle')}
          aria-label={t('layout.supportEmailTitle')}
        >
          <svg className={styles.envelopeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </a>
      </footer>
    </div>
  );
}
