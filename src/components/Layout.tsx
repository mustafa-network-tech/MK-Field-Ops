import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { useI18n } from '../i18n/I18nContext';
import styles from './Layout.module.css';

export function Layout() {
  const { t } = useI18n();

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
            <NavLink to="/approvals" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
              {t('nav.approvals')}
            </NavLink>
            <NavLink to="/reports" className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}>
              {t('nav.reports')}
            </NavLink>
          </nav>
        </aside>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
