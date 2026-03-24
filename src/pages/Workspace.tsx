/**
 * Workspace step after register: choose Create New Company or Join Existing.
 * Uses company name + 4-digit join code. Plan/billing use defaults (or ?plan= from register URL).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { createPendingSignupApi } from '../services/paidSignupApi';
import { setPaidSignupSession, clearPaidSignupSession } from '../services/paidSignupSession';
import { setPendingNewCompanySignup } from '../services/pendingNewCompanySignup';
import styles from './Workspace.module.css';

type WorkspaceMode = 'choose' | 'new' | 'existing';
type PlanKey = 'starter' | 'professional' | 'enterprise';

const DEFAULT_NEW_COMPANY_PLAN: PlanKey = 'professional';

export function Workspace() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { email?: string; password?: string; fullName?: string; plan?: string } | null;
  const planFromRegister: PlanKey | null =
    state?.plan && ['starter', 'professional', 'enterprise'].includes(state.plan) ? (state.plan as PlanKey) : null;
  const resolvedPlan = planFromRegister ?? DEFAULT_NEW_COMPANY_PLAN;

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
    setError('');
    setMessage('');
    const name = companyName.trim();
    const code = joinCode.trim();
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
      if (supabase) {
        clearPaidSignupSession();
        const { pending_signup_id, signup_token } = await createPendingSignupApi({
          full_name: fullName,
          email,
          password,
          campaign_name: name,
          campaign_code: code,
        });
        setPaidSignupSession({
          pending_signup_id,
          signup_token,
          email,
          password,
          full_name: fullName,
        });
        const q = new URLSearchParams({
          plan: resolvedPlan,
          from: 'registration',
          pending_signup_id: pending_signup_id,
        });
        navigate(`/plan-and-payment?${q.toString()}`, { replace: true });
      } else {
        setPendingNewCompanySignup({
          email,
          password,
          fullName,
          companyName: name,
          joinCode: code,
        });
        navigate(`/plan-and-payment?plan=${resolvedPlan}&from=registration`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('planChangePage.errorGeneric'));
    } finally {
      setLoading(false);
    }
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
