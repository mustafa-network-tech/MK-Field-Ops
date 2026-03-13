import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { updateCompanyLanguageInSupabase } from '../services/companyService';
import { store } from '../data/store';
import styles from './TopBar.module.css';

const roleKeys: Record<string, string> = {
  companyManager: 'roles.companyManager',
  projectManager: 'roles.projectManager',
  teamLeader: 'roles.teamLeader',
};

const langKeys: Record<string, string> = {
  en: 'topBar.langEn',
  tr: 'topBar.langTr',
  es: 'topBar.langEs',
  fr: 'topBar.langFr',
  de: 'topBar.langDe',
};

const planKeys: Record<string, string> = {
  starter: 'onboarding.planStarter',
  professional: 'onboarding.planProfessional',
  enterprise: 'onboarding.planEnterprise',
};

const LOCALES = ['en', 'tr', 'es', 'fr', 'de'] as const;

export function TopBar() {
  const { t, locale, setLocale } = useI18n();
  const { user, setUser, refreshCompany } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

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

  const company = user.companyId ? store.getCompany(user.companyId, user.companyId) : undefined;
  const companyName = company?.name ?? '';
  const companyLogoUrl = company?.logo_url ?? null;
  const planLabel = company?.plan ? t(planKeys[company.plan] ?? company.plan) : null;
  const canChangeLanguage = user.role === 'companyManager' || user.role === 'projectManager';

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
          <span className={styles.companyName}>
            {companyName || '…'}
            {planLabel && <span className={styles.companyPlan}> ({planLabel})</span>}
          </span>
        </div>
      )}
      <div className={styles.right}>
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
                      {t(langKeys[loc])}
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
