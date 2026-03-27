import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService, getCompanyNameFromUserMetadata } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { updateCompanyLanguageInSupabase } from '../services/companyService';
import { getEffectivePlan, getPlanWarningState, formatPlanExpiryRemaining } from '../services/subscriptionService';
import { store } from '../data/store';
import styles from './TopBar.module.css';

type TopBarProps = { managementNotificationCount?: number };

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

export function TopBar({ managementNotificationCount = 0 }: TopBarProps) {
  const { t, locale, setLocale } = useI18n();
  const { user, company, setUser, refreshCompany } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const [companyNameFromSessionMeta, setCompanyNameFromSessionMeta] = useState<string | null>(null);

  const canChangeLanguage = user?.role === 'companyManager' || user?.role === 'projectManager';
  const canSeePlanWarning = user?.role === 'companyManager' || user?.role === 'projectManager';

  useEffect(() => {
    if (!supabase || !user?.companyId) {
      setCompanyNameFromSessionMeta(null);
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session?.user) return;
      setCompanyNameFromSessionMeta(getCompanyNameFromUserMetadata(session.user));
    });
    return () => {
      cancelled = true;
    };
  }, [user?.companyId, user?.id]);

  /** Store’da isim boşsa oturum metadata’sı ile doldur (PM/CM aynı görünüm). */
  useEffect(() => {
    const cid = user?.companyId;
    const meta = companyNameFromSessionMeta?.trim();
    if (!cid || !meta) return;
    const c = store.getCompany(cid, cid);
    if (c && String(c.name ?? '').trim()) return;
    store.ensureCompany(cid, meta);
    refreshCompany();
  }, [user?.companyId, companyNameFromSessionMeta, refreshCompany]);

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

  const handleLogout = () => {
    authService.logout();
    setUser(undefined);
    navigate('/login');
  };

  const goReports = () => navigate('/reports');

  const goManagement = () => navigate('/management');
  const isManagement = location.pathname.startsWith('/management');

  if (!user) return null;

  const companyName = (company?.name?.trim() ? company.name : companyNameFromSessionMeta)?.trim() ?? '';
  const companyLogoUrl = company?.logo_url ?? null;
  const effectivePlan = getEffectivePlan(company);
  const planLabel = effectivePlan ? t(planKeys[effectivePlan] ?? effectivePlan) : null;
  const planWarningState = getPlanWarningState(company);
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

  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        <span className={styles.userName}>{user.fullName}</span>
        {user.role && <span className={styles.role}> – {t(roleKeys[user.role] ?? user.role)}</span>}
      </div>
      {user.companyId && (
        <div className={styles.center}>
          {companyLogoUrl && (
            <img src={companyLogoUrl} alt="" className={styles.companyLogo} />
          )}
          <span className={styles.companyName} title={companyName || undefined}>
            {companyName?.trim() ? companyName : t('topBar.companyNamePending')}
            {planLabel && <span className={styles.companyPlan}> ({planLabel})</span>}
          </span>
        </div>
      )}
      <div className={styles.right}>
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
        <button
          type="button"
          className={`${styles.navBtn} ${managementNotificationCount > 0 ? styles.navBtnPulse : ''}`}
          onClick={goManagement}
          data-active={isManagement}
          aria-label={
            managementNotificationCount > 0
              ? `${t('topBar.managementPanel')} (${managementNotificationCount})`
              : t('topBar.managementPanel')
          }
        >
          <span className={styles.navBtnLabel}>{t('topBar.managementPanel')}</span>
          {managementNotificationCount > 0 && (
            <span className={styles.navBtnBadge} aria-hidden>
              {managementNotificationCount}
            </span>
          )}
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
