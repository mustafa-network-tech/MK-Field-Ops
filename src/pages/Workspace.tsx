import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { store } from '../data/store';
import styles from './Workspace.module.css';

type WorkspaceMode = 'choose' | 'new' | 'existing';

export function Workspace() {
  const { t } = useI18n();
  const { setUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { email?: string; password?: string; fullName?: string } | null;

  const [mode, setMode] = useState<WorkspaceMode>('choose');
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!state?.email || !state?.password || !state?.fullName) {
    navigate('/register', { replace: true });
    return null;
  }

  const { email, password, fullName } = state;

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!companyName.trim()) {
      setError(t('validation.required'));
      return;
    }
    setLoading(true);
    try {
      const result = await authService.registerNewCompany({
        email,
        password,
        fullName,
        companyName: companyName.trim(),
      });
      if (!result.ok) {
        setError(t(result.error ?? 'auth.loginError'));
        return;
      }
      setUser(store.getCurrentUser());
      navigate('/', { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!companyId.trim()) {
      setError(t('auth.enterCompanyId'));
      return;
    }
    setLoading(true);
    try {
      const result = await authService.registerExistingCompany({
        email,
        password,
        fullName,
        companyId: companyId.trim(),
      });
      if (!result.ok) {
        setError(t(result.error ?? 'auth.loginError'));
        return;
      }
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
            <button type="button" className={styles.optionBtn} onClick={() => setMode('new')}>
              {t('onboarding.createNewCompany')}
            </button>
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
              {t('auth.companyId')}
              <input
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={styles.input}
                placeholder={t('auth.companyIdPlaceholder')}
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
