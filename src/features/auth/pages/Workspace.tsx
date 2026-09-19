import { getRegistrationDraft, clearRegistrationDraft } from '../services/registrationDraft';
/**
 * Workspace step after register: choose Create New Company or Join Existing.
 * Uses company name + 4-digit join code. Plan/billing use defaults (or ?plan= from register URL).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n/I18nContext';
import { authService, toAuthErrorKey } from '@/features/auth/services/authService';
import styles from './Workspace.module.css';

type WorkspaceMode = 'choose' | 'new' | 'existing';

export function Workspace() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [state] = useState(getRegistrationDraft);
  useEffect(() => () => clearRegistrationDraft(), []);

  const [mode, setMode] = useState<WorkspaceMode>('choose');
  const [companyName, setCompanyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [existingCompanyName, setExistingCompanyName] = useState('');
  const [existingJoinCode, setExistingJoinCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const hasRegistrationState = Boolean(state?.email && state?.password && state?.fullName);

  useEffect(() => {
    if (!hasRegistrationState) {
      navigate('/register', { replace: true });
    }
  }, [hasRegistrationState, navigate]);

  if (!hasRegistrationState) {
    return null;
  }

  const { email, password, fullName } = state as {
    email: string;
    password: string;
    fullName: string;
    plan?: string;
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(t('onboarding.paidSignupDisabled'));
  };

  const handleJoinExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const name = existingCompanyName.trim();
    const code = existingJoinCode.trim();
    if (!name) {
      setError(t('validation.required'));
      return;
    }
    if (!/^\d{4}$/.test(code)) {
      setError(t('auth.joinCodeInvalid'));
      return;
    }
    setLoading(true);
    try {
      const result = await authService.registerExistingCompany({
        email,
        password,
        fullName,
        companyName: name,
        joinCode: code,
      });
      if (!result.ok) {
        setError(t(toAuthErrorKey(result.error)));
        return;
      }
      clearRegistrationDraft();
      setMessage(t('auth.pendingCompanyManagerApproval'));
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <h2 className={styles.subtitle}>{t('onboarding.workspaceTitle')}</h2>

        {mode === 'choose' && (
          <div className={styles.choose}>
            <button type="button" className={styles.optionBtn} disabled>
              {t('onboarding.createNewCompany')}
            </button>
            <p>{t('onboarding.paidSignupDisabled')}</p>
            <button type="button" className={styles.optionBtn} onClick={() => setMode('existing')}>
              {t('onboarding.joinExistingCompany')}
            </button>
            <p className={styles.backLink}>
              <Link to="/register">{t('common.back')}</Link>
            </p>
          </div>
        )}

        {mode === 'new' && (
          <form onSubmit={handleCreateNew} className={styles.form}>
            <label className={styles.label}>
              {t('auth.companyName')}
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={styles.input}
                placeholder={t('auth.companyNamePlaceholder')}
                required
              />
            </label>
            <label className={styles.label}>
              {t('auth.joinCode')}
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className={styles.input}
                placeholder={t('auth.joinCodePlaceholder')}
                maxLength={4}
                inputMode="numeric"
                required
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            {message && <p className={styles.message}>{message}</p>}
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setMode('choose')}>
                {t('common.back')}
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={loading}>
                {loading ? '...' : t('auth.register')}
              </button>
            </div>
          </form>
        )}

        {mode === 'existing' && (
          <form onSubmit={handleJoinExisting} className={styles.form}>
            <label className={styles.label}>
              {t('auth.companyName')}
              <input
                value={existingCompanyName}
                onChange={(e) => setExistingCompanyName(e.target.value)}
                className={styles.input}
                placeholder={t('auth.companyNamePlaceholder')}
                required
              />
            </label>
            <label className={styles.label}>
              {t('auth.joinCode')}
              <input
                value={existingJoinCode}
                onChange={(e) => setExistingJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className={styles.input}
                placeholder={t('auth.joinCodePlaceholder')}
                maxLength={4}
                inputMode="numeric"
                required
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            {message && <p className={styles.message}>{message}</p>}
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setMode('choose')}>
                {t('common.back')}
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={loading}>
                {loading ? '...' : t('auth.register')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
