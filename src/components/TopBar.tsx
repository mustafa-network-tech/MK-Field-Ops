import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { updateCompanyLanguageInSupabase } from '../services/companyService';
import { store } from '../data/store';
import { getEffectivePlan, getPlanWarningState, formatPlanExpiryRemaining } from '../services/subscriptionService';
import {
  getActivityNotifications,
  getActivityUnreadCount,
  markActivityAsRead,
  markAllActivityAsRead,
  subscribeActivityNotifications,
} from '../services/activityNotificationService';
import type { ActivityNotification } from '../types';
import styles from './TopBar.module.css';

type TopBarProps = { pendingApprovalsCount?: number };

const roleKeys: Record<string, string> = {
  companyManager: 'roles.companyManager',
  projectManager: 'roles.projectManager',
  teamLeader: 'roles.teamLeader',
};

const planKeys: Record<string, string> = {
  starter: 'onboarding.planStarter',
  professional: 'onboarding.planProfessional',
  enterprise: 'onboarding.planEnterprise',
};

const LOCALES = ['en', 'tr', 'es', 'fr', 'de'] as const;

export function TopBar({ pendingApprovalsCount = 0 }: TopBarProps) {
  const { t, locale, setLocale } = useI18n();
  const { user, setUser, refreshCompany } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [langOpen, setLangOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const companyId = user?.companyId ?? '';
  const isCompanyManager = user?.role === 'companyManager';
  const activityNotifications = isCompanyManager ? getActivityNotifications(companyId) : [];
  const activityUnreadCount = isCompanyManager ? getActivityUnreadCount(companyId) : 0;

  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!isCompanyManager) return;
    return subscribeActivityNotifications(() => forceUpdate((n) => n + 1));
  }, [isCompanyManager]);

  useEffect(() => {
    if (!langOpen) return;
    const close = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [langOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const close = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [notificationsOpen]);

  useEffect(() => {
    if (activityUnreadCount > 0) setToastVisible(true);
  }, [activityUnreadCount]);
  useEffect(() => {
    if (!toastVisible) return;
    const t = setTimeout(() => setToastVisible(false), 6000);
    return () => clearTimeout(t);
  }, [toastVisible]);

  const handleLogout = () => {
    authService.logout();
    setUser(undefined);
    navigate('/login');
  };

  const goReports = () => navigate('/reports');

  const goManagement = () => navigate('/management');
  const isManagement = location.pathname.startsWith('/management');

  if (!user) return null;

  const company = user.companyId ? store.getCompany(user.companyId, user.companyId) : undefined;
  const companyName = company?.name ?? '';
  const companyLogoUrl = company?.logo_url ?? null;
  const effectivePlan = getEffectivePlan(company);
  const planLabel = effectivePlan ? t(planKeys[effectivePlan] ?? effectivePlan) : null;
  const canChangeLanguage = user.role === 'companyManager' || user.role === 'projectManager';
  const planWarningState = getPlanWarningState(company);
  const canSeePlanWarning = user.role === 'companyManager' || user.role === 'projectManager';
  const planWarningText = planWarningState && canSeePlanWarning
    ? (() => {
        if (planWarningState.kind === 'expiring_soon') {
          const { days, hours } = formatPlanExpiryRemaining(planWarningState.remainingMs);
          if (days > 0) return t('planExpiry.daysHoursLeft', { days, hours });
          return t('planExpiry.hoursLeft', { hours });
        }
        if (planWarningState.kind === 'suspended') {
          return t('planExpiry.suspendedGrace', { days: planWarningState.graceRemainingDays });
        }
        return t('planExpiry.closed');
      })()
    : null;

  function formatNotificationTime(createdAt: string): string {
    const d = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString();
  }

  return (
    <header className={styles.topBar}>
      {isCompanyManager && toastVisible && activityUnreadCount > 0 && (
        <div className={styles.notificationToast} role="status">
          <span>{t('notifications.newCount', { count: activityUnreadCount })}</span>
        </div>
      )}
      <div className={styles.left}>
        <span className={styles.userName}>{user.fullName}</span>
        {user.role && <span className={styles.role}> – {t(roleKeys[user.role] ?? user.role)}</span>}
      </div>
      {user.companyId && (
        <div className={styles.center}>
          {companyLogoUrl && (
            <img src={companyLogoUrl} alt="" className={styles.companyLogo} />
          )}
          <span className={styles.companyName}>
            {companyName || '…'}
            {planLabel && <span className={styles.companyPlan}> ({planLabel})</span>}
          </span>
        </div>
      )}
      <div className={styles.right}>
        {pendingApprovalsCount > 0 && (
          <button
            type="button"
            className={styles.approvalNotification}
            onClick={() => navigate('/approvals')}
            title={t('approvals.pendingNotification', { count: pendingApprovalsCount })}
          >
            <span className={styles.approvalNotificationBadge} aria-hidden>{pendingApprovalsCount}</span>
            <span className={styles.approvalNotificationText}>{t('approvals.pendingNotification', { count: pendingApprovalsCount })}</span>
          </button>
        )}
        {canSeePlanWarning && planWarningText && (
          <button
            type="button"
            className={styles.planExpiryWarning}
            onClick={() => navigate('/plan-and-payment')}
            title={planWarningText}
          >
            <span className={styles.planExpiryWarningIcon} aria-hidden>⚠</span>
            <span className={styles.planExpiryWarningText}>{planWarningText}</span>
          </button>
        )}
        {isCompanyManager && (
          <div className={styles.notificationBellWrap} ref={notifRef}>
            <button
              type="button"
              className={styles.notificationBell}
              onClick={() => setNotificationsOpen((o) => !o)}
              aria-expanded={notificationsOpen}
              aria-label={t('notifications.title')}
              title={t('notifications.title')}
            >
              <span className={styles.notificationBellIcon} aria-hidden>🔔</span>
              {activityUnreadCount > 0 && (
                <span className={styles.notificationBellBadge} aria-hidden>{activityUnreadCount}</span>
              )}
            </button>
            {notificationsOpen && (
              <div className={styles.notificationDropdown}>
                <div className={styles.notificationDropdownHeader}>
                  <span>{t('notifications.title')}</span>
                  {activityUnreadCount > 0 && (
                    <button
                      type="button"
                      className={styles.notificationMarkAllRead}
                      onClick={() => markAllActivityAsRead(companyId)}
                    >
                      {t('notifications.markAllRead')}
                    </button>
                  )}
                </div>
                <ul className={styles.notificationList}>
                  {activityNotifications.length === 0 ? (
                    <li className={styles.notificationItemEmpty}>{t('notifications.noNotifications')}</li>
                  ) : (
                    activityNotifications.map((n: ActivityNotification) => (
                      <li
                        key={n.id}
                        className={n.read ? styles.notificationItem : `${styles.notificationItem} ${styles.notificationItemUnread}`}
                      >
                        <button
                          type="button"
                          className={styles.notificationItemBtn}
                          onClick={() => {
                            if (!n.read) markActivityAsRead(n.id);
                          }}
                        >
                          <span className={styles.notificationItemText}>
                            {t(n.titleKey, n.meta as Record<string, string>)}
                          </span>
                          <span className={styles.notificationItemTime}>{formatNotificationTime(n.createdAt)}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
        <button type="button" className={styles.navBtn} onClick={goManagement} data-active={isManagement}>
          {t('topBar.managementPanel')}
        </button>
        <button type="button" className={styles.excelBtn} onClick={goReports}>
          {t('common.export')}
        </button>
        {canChangeLanguage ? (
          <div className={styles.langDropdown} ref={langRef}>
            <button
              type="button"
              className={styles.langTrigger}
              onClick={() => setLangOpen((o) => !o)}
              aria-expanded={langOpen}
              aria-haspopup="listbox"
              aria-label={t('topBar.language')}
            >
              <span className={styles.langGlobe} aria-hidden>🌐</span>
              <span className={styles.langCode}>{locale.toUpperCase()}</span>
              <span className={styles.langChevron} aria-hidden>{langOpen ? '▴' : '▾'}</span>
            </button>
            {langOpen && (
              <ul className={styles.langMenu} role="listbox">
                {LOCALES.map((loc) => (
                  <li key={loc} role="option" aria-selected={locale === loc}>
                    <button
                      type="button"
                      className={styles.langOption}
                      onClick={async () => {
                        setLocale(loc);
                        setLangOpen(false);
                        if (user.companyId) {
                          await updateCompanyLanguageInSupabase(user.companyId, loc);
                          refreshCompany();
                        }
                      }}
                    >
                      {loc.toUpperCase()}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
          {t('auth.logout')}
        </button>
      </div>
    </header>
  );
}
