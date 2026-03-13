import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import styles from './Welcome.module.css';

export function Welcome() {
  const { t } = useI18n();

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logoBlock}>
          <div className={styles.logo} aria-hidden />
          <h1 className={styles.title}>{t('onboarding.welcomeTitle')}</h1>
          <p className={styles.tagline}>{t('onboarding.tagline')}</p>
        </div>
        <div className={styles.actions}>
          <Link to="/login" className={styles.primaryBtn}>
            {t('onboarding.signIn')}
          </Link>
          <Link to="/register" className={styles.secondaryBtn}>
            {t('onboarding.startFree')}
          </Link>
        </div>
        <p className={styles.footer}>{t('onboarding.poweredBy')}</p>
      </div>
    </div>
  );
}
