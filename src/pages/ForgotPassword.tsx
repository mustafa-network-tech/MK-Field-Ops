import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import styles from './Auth.module.css';

export function ForgotPassword() {
  const { t } = useI18n();
  const { user } = useApp();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSent(false);
    setLoading(true);
    try {
      const result = await authService.requestPasswordReset(email.trim());
      if (!result.ok) {
        const errorMessage =
          result.error === 'auth.forgotPasswordNotConfigured' || result.error === 'auth.forgotPasswordRateLimit'
            ? t(result.error)
            : result.error ?? 'An error occurred';
        setError(errorMessage);
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <h2 className={styles.subtitle}>{t('auth.forgotPasswordTitle')}</h2>
        {user && <p className={styles.message}>{t('auth.forgotPasswordWhileLoggedIn')}</p>}
        {sent ? (
          <p className={styles.message}>{t('auth.forgotPasswordSent')}</p>
        ) : (
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
            {error && <p className={styles.error}>{error}</p>}
            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? '...' : t('auth.forgotPasswordSend')}
            </button>
          </form>
        )}
        <p className={styles.footer}>
          <Link to="/login">{t('auth.backToLogin')}</Link>
        </p>
      </div>
    </div>
  );
}
