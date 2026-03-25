import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import styles from './Auth.module.css';

const VALID_PLANS = ['starter', 'professional', 'enterprise'];

export function Register() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planFromUrl = searchParams.get('plan');
  const initialPlan = planFromUrl && VALID_PLANS.includes(planFromUrl) ? planFromUrl : null;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const first = firstName.trim();
    const last = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!first || !last) {
      setError(t('validation.required'));
      return;
    }
    if (!normalizedEmail) {
      setError(t('validation.required'));
      return;
    }
    setLoading(true);
    const fullName = `${first} ${last}`.trim();
    navigate('/workspace', {
      replace: false,
      state: { email: normalizedEmail, password, fullName, plan: initialPlan },
    });
    setLoading(false);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <h2 className={styles.subtitle}>{t('onboarding.createAccount')}</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            {t('auth.firstName')}
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={styles.input}
              required
              autoComplete="given-name"
            />
          </label>
          <label className={styles.label}>
            {t('auth.lastName')}
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={styles.input}
              required
              autoComplete="family-name"
            />
          </label>
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
              autoComplete="new-password"
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.primaryBtn} disabled={loading}>
            {loading ? '...' : t('onboarding.nextStep')}
          </button>
        </form>
        <p className={styles.footer}>
          {t('auth.login')}? <Link to="/login">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
}
