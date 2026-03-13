import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { useApp } from '../context/AppContext';
import { authService } from '../services/authService';
import styles from './Auth.module.css';

export function PendingJoin() {
  const { t } = useI18n();
  const { setUser } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    authService.logout();
    setUser(undefined);
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('app.title')}</h1>
        <h2 className={styles.subtitle}>{t('pendingJoin.title')}</h2>
        <p className={styles.message}>{t('pendingJoin.message')}</p>
        <p className={styles.footer}>
          <button type="button" className={styles.primaryBtn} onClick={handleLogout}>
            {t('auth.backToLogin')}
          </button>
        </p>
      </div>
    </div>
  );
}
