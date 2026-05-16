import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n/I18nContext';
import { useApp } from '@/app/providers/AppContext';
import { authService, toAuthErrorKey } from '@/features/auth/services/authService';
import { supabase } from '@/lib/supabase/supabaseClient';
import styles from './Auth.module.css';

export function PendingJoin() {
  const { t } = useI18n();
  const { setUser } = useApp();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { data: { user } } = await client.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setChecking(false);
          return;
        }
        const { data } = await client
          .from('join_requests')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();
        if (cancelled) return;
        setHasPendingRequest(Boolean(data?.id));
        setChecking(false);
      } catch {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = () => {
    authService.logout();
    setUser(undefined);
    navigate('/login', { replace: true });
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      const result = await authService.requestJoinCompany({ companyName, joinCode });
      if (!result.ok) {
        setError(t(toAuthErrorKey(result.error)));
        return;
      }
      setHasPendingRequest(true);
      setMessage(t('pendingJoin.requestSent'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        {checking ? (
          <p className={styles.message}>{t('common.loading')}</p>
        ) : hasPendingRequest ? (
          <>
            <h2 className={styles.subtitle}>{t('pendingJoin.title')}</h2>
            <p className={styles.message}>{t('pendingJoin.message')}</p>
            {message ? <p className={styles.message}>{message}</p> : null}
            <p className={styles.footer}>
              <button type="button" className={styles.primaryBtn} onClick={handleLogout}>
                {t('auth.backToLogin')}
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className={styles.subtitle}>{t('pendingJoin.detachedTitle')}</h2>
            <p className={styles.message}>{t('pendingJoin.detachedMessage')}</p>
            <form onSubmit={handleJoinSubmit} className={styles.form}>
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
              {error ? <p className={styles.error}>{error}</p> : null}
              <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                {submitting ? '...' : t('pendingJoin.submitJoin')}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={handleLogout}>
                {t('auth.logout')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
