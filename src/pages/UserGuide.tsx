import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import styles from './UserGuide.module.css';

/**
 * Kullanım kılavuzu sayfası (landing’deki "Kullanım Kılavuzu" butonu buraya yönlendirir).
 * Detaylı içerik sonradan eklenebilir.
 */
export function UserGuide() {
  const { t } = useI18n();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.backLink}>← {t('userGuide.backToHome')}</Link>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t('landing.heroGuide')}</h1>
        <p className={styles.placeholder}>
          {t('userGuide.comingSoon')}
        </p>
      </main>
    </div>
  );
}
