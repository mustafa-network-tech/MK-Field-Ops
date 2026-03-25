import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { supabase } from '../services/supabaseClient';
import styles from './Auth.module.css';

function parseHashTokens() {
  const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(raw);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  const type = params.get('type');
  return { access_token, refresh_token, type };
}

function parseQueryCode() {
  const qs = new URLSearchParams(window.location.search);
  return qs.get('code');
}

export function ResetPassword() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function initRecoverySession() {
      if (!supabase) {
        if (mounted) setError(t('auth.forgotPasswordNotConfigured'));
        return;
      }
      const code = parseQueryCode();
      if (code) {
        const { error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (codeErr && mounted) {
          setError(codeErr.message);
          return;
        }
      }
      const { access_token, refresh_token, type } = parseHashTokens();
      if (type === 'recovery' && access_token && refresh_token) {
        const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
        if (setErr && mounted) {
          setError(setErr.message);
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        if (mounted) setError('Şifre sıfırlama oturumu bulunamadı. Lütfen e-posta linkini yeniden açın.');
        return;
      }
      if (mounted) setReady(true);
    }
    initRecoverySession();
    return () => {
      mounted = false;
    };
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) {
      setError(t('auth.forgotPasswordNotConfigured'));
      return;
    }
    if (!password || !password2) {
      setError(t('validation.required'));
      return;
    }
    if (password !== password2) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    if (password.length < 6) {
      setError(t('validation.minLength', { min: 6 }));
      return;
    }
    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      setMessage('Şifreniz güncellendi. Giriş sayfasına yönlendiriliyorsunuz.');
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <h2 className={styles.subtitle}>Yeni şifre belirle</h2>
        {!ready ? (
          <>
            {error ? <p className={styles.error}>{error}</p> : <p className={styles.message}>Bağlantı doğrulanıyor...</p>}
            <p className={styles.footer}>
              <Link to="/login">{t('auth.backToLogin')}</Link>
            </p>
          </>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
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
            <label className={styles.label}>
              Yeni şifre (tekrar)
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className={styles.input}
                required
              />
            </label>
            {error && <p className={styles.error}>{error}</p>}
            {message && <p className={styles.message}>{message}</p>}
            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? '...' : 'Şifreyi Güncelle'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
