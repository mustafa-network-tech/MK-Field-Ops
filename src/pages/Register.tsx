import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import { store } from '../data/store';
import type { Role } from '../types';
import styles from './Auth.module.css';

export function Register() {
  const { t } = useI18n();
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState<Role>('teamLeader');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const companies = store.getCompanies();
  const isNewCompany = !companyId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (companies.length > 0 && !companyId && !companyName.trim()) {
      setError(t('validation.required'));
      return;
    }
    const result = isNewCompany
      ? authService.register({ email, password, fullName, companyName: companyName.trim(), role })
      : authService.registerExistingCompany({ email, password, fullName, companyId, role });
    if (!result.ok) {
      setError(t(result.error!));
      return;
    }
    setUser(store.getCurrentUser());
    if (result.needsApproval) {
      setMessage(t('users.pending'));
    }
    navigate('/', { replace: true });
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
          {companies.length > 0 && (
            <>
              <label className={styles.label}>
                Join existing company
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    if (e.target.value) setCompanyName('');
                  }}
                  className={styles.input}
                >
                  <option value="">-- New company --</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              {!companyId && (
                <label className={styles.label}>
                  {t('auth.companyName')} (new company)
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className={styles.input}
                  />
                </label>
              )}
            </>
          )}
          {companies.length === 0 && (
            <label className={styles.label}>
              {t('auth.companyName')}
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={styles.input}
                required
              />
            </label>
          )}
          <label className={styles.label}>
            {t('auth.role')}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={styles.input}
            >
              <option value="companyManager">{t('roles.companyManager')}</option>
              <option value="projectManager">{t('roles.projectManager')}</option>
              <option value="teamLeader">{t('roles.teamLeader')}</option>
            </select>
          </label>
          {error && <p className={styles.error}>{error}</p>}
          {message && <p className={styles.message}>{message}</p>}
          <button type="submit" className={styles.primaryBtn}>{t('auth.register')}</button>
        </form>
        <p className={styles.footer}>
          {t('auth.login')}? <Link to="/login">{t('auth.login')}</Link>
        </p>
      </div>
    </div>
  );
}
