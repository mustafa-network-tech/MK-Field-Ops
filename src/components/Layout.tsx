import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { canPlanAccessFeature } from '../services/planGating';
import type { CompanyLanguageCode } from '../types';
import styles from './Layout.module.css';

const VALID_LOCALES: CompanyLanguageCode[] = ['en', 'tr', 'es', 'fr', 'de'];

export function Layout() {
  const { t, setLocale } = useI18n();
  const { user, company } = useApp();

  useEffect(() => {
    const code = company?.language_code;
    if (code && VALID_LOCALES.includes(code)) setLocale(code);
  }, [company?.language_code, setLocale]);
  const planAllowsDeliveryNotes = canPlanAccessFeature(company?.plan, 'deliveryNotes');
  const canAccessDeliveryNotes = (user?.role === 'companyManager' || user?.role === 'projectManager') && planAllowsDeliveryNotes;
  const canAccessSettingsAndPayroll = user?.role === 'companyManager' || user?.role === 'projectManager';
  const canAccessAuditLogs = user?.role === 'companyManager' || user?.role === 'projectManager';

  return (
    <div className={styles.layout}>
      <TopBar />
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
            <NavLink to="/approvals" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
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
          </nav>
        </aside>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
