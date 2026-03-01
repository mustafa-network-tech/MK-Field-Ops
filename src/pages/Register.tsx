import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { store } from '../data/store';
import styles from './Auth.module.css';

type RegisterMode = 'new' | 'existing';

export function Register() {
  const { t } = useI18n();
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [mode, setMode] = useState<RegisterMode>('new');
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'new') {
        if (!companyName.trim()) {
          setError(t('validation.required'));
          return;
        }
        const result = await authService.registerNewCompany({ email, password, fullName, companyName: companyName.trim() });
        if (!result.ok) {
          setError(t(result.error ?? 'auth.loginError'));
          return;
        }
        setUser(store.getCurrentUser());
        navigate('/', { replace: true });
        return;
      }
      if (mode === 'existing') {
        if (!companyId.trim()) {
          setError(t('auth.enterCompanyId'));
          return;
        }
        const result = await authService.registerExistingCompany({ email, password, fullName, companyId: companyId.trim() });
        if (!result.ok) {
          setError(t(result.error ?? 'auth.loginError'));
          return;
        }
        setMessage(t('auth.pendingCompanyManagerApproval'));
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <h2 className={styles.subtitle}>{t('auth.register')}</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            {t('auth.fullName')}
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={styles.input}
              required
            />
          </label>
          <label className={styles.label}>
            {t('auth.email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              required
            />
          </label>
          <label className={styles.label}>
            {t('auth.password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
            />
          </label>

          <div className={styles.label}>
            {t('auth.company')}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="radio"
                  name="companyMode"
                  checked={mode === 'new'}
                  onChange={() => { setMode('new'); setCompanyId(''); }}
                />
                {t('auth.newCompany')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="radio"
                  name="companyMode"
                  checked={mode === 'existing'}
                  onChange={() => { setMode('existing'); setCompanyName(''); }}
                />
                {t('auth.existingCompany')}
              </label>
            </div>
          </div>

          {mode === 'new' && (
            <label className={styles.label}>
              {t('auth.companyName')}
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={styles.input}
                placeholder={t('auth.companyNamePlaceholder')}
              />
            </label>
          )}
          {mode === 'existing' && (
            <label className={styles.label}>
              {t('auth.companyId')}
              <input
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={styles.input}
                placeholder={t('auth.companyIdPlaceholder')}
              />
            </label>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.message}>{message}</p>}
          <button type="submit" className={styles.primaryBtn} disabled={loading}>{loading ? '...' : t('auth.register')}</button>
        </form>
        <p className={styles.footer}>
          {t('auth.login')}? <Link to="/login">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
}
