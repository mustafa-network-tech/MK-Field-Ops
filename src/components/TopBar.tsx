import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { exportDashboardToExcel } from '../services/excelExportService';
import styles from './TopBar.module.css';

const roleKeys: Record<string, string> = {
  companyManager: 'roles.companyManager',
  projectManager: 'roles.projectManager',
  teamLeader: 'roles.teamLeader',
};

export function TopBar() {
  const { t, locale, setLocale } = useI18n();
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    authService.logout();
    setUser(undefined);
    navigate('/login');
  };

  const handleExcelExport = () => {
    if (user?.companyId) {
      exportDashboardToExcel(user.companyId, user);
    }
  };

  const goManagement = () => navigate('/management');
  const isManagement = location.pathname.startsWith('/management');

  if (!user) return null;

  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        <span className={styles.userName}>{user.fullName}</span>
        <span className={styles.role}> – {t(roleKeys[user.role] ?? user.role)}</span>
      </div>
      <div className={styles.right}>
        <button type="button" className={styles.navBtn} onClick={goManagement} data-active={isManagement}>
          {t('topBar.managementPanel')}
        </button>
        <button type="button" className={styles.excelBtn} onClick={handleExcelExport}>
          {t('topBar.excelExport')}
        </button>
        <div className={styles.langGroup}>
          <button
            type="button"
            className={styles.langBtn}
            onClick={() => setLocale('en')}
            aria-pressed={locale === 'en'}
          >
            {t('topBar.langEn')}
          </button>
          <button
            type="button"
            className={styles.langBtn}
            onClick={() => setLocale('tr')}
            aria-pressed={locale === 'tr'}
          >
            {t('topBar.langTr')}
          </button>
        </div>
        <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
          {t('auth.logout')}
        </button>
      </div>
    </header>
  );
}
