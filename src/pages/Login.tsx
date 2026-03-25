import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { store } from '../data/store';
import styles from './Auth.module.css';

export function Login() {
  const { t } = useI18n();
  const { setUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const afterPaidRegistration = Boolean((location.state as { afterPaidRegistration?: boolean } | null)?.afterPaidRegistration);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await authService.login(email, password);
      if (!result.ok) {
        setError(t(result.error ?? 'auth.loginError'));
        return;
      }
      const loggedUser = store.getCurrentUser();
      setUser(loggedUser);
      if (loggedUser?.role === 'superAdmin') {
        navigate('/super-admin', { replace: true });
      } else {
        navigate(loggedUser?.companyId ? '/' : '/pending-join', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <h2 className={styles.subtitle}>{t('auth.login')}</h2>
        {afterPaidRegistration && <p className={styles.message}>{t('auth.afterPaidRegistrationHint')}</p>}
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            {t('auth.email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.replace(/\s+/g, ''))}
              className={styles.input}
              required
              autoComplete="email"
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
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.primaryBtn} disabled={loading}>{loading ? '...' : t('auth.login')}</button>
        </form>
        <p className={styles.footer}>
          {t('auth.register')}? <Link to="/register">{t('auth.register')}</Link>
        </p>
        <p className={styles.forgotBottomRight}>
          <Link to="/forgot-password" className={styles.footerLink}>{t('auth.forgotPassword')}</Link>
        </p>
      </div>
    </div>
  );
}
