import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { store } from '../data/store';
import styles from './Auth.module.css';

export function Login() {
  const { t } = useI18n();
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');

  const companies = store.getCompanies();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = authService.login(email, password, companyId || undefined);
    if (!result.ok) {
      setError(t(result.error!));
      return;
    }
    setUser(store.getCurrentUser());
    navigate('/', { replace: true });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <h2 className={styles.subtitle}>{t('auth.login')}</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          {companies.length > 0 && (
            <label className={styles.label}>
              {t('auth.companyName')} (optional – select company)
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className={styles.input}
              >
                <option value="">-- {t('common.search')} --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
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
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.primaryBtn}>{t('auth.login')}</button>
        </form>
        <p className={styles.footer}>
          {t('auth.register')}? <Link to="/register">{t('auth.register')}</Link>
        </p>
      </div>
    </div>
  );
}
