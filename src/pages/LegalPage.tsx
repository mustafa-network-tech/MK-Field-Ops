import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import styles from './UserGuide.module.css';

const ROUTES: Record<string, { titleKey: string; comingSoonKey: string }> = {
  '/gizlilik-politikasi': { titleKey: 'landing.footerPrivacy', comingSoonKey: 'legal.privacyComingSoon' },
  '/geri-odeme-politikasi': { titleKey: 'landing.footerRefund', comingSoonKey: 'legal.refundComingSoon' },
};

/**
 * Gizlilik, Kullanım Şartları, Geri Ödeme sayfaları için ortak placeholder.
 */
export function LegalPage() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const config = ROUTES[pathname] ?? ROUTES['/geri-odeme-politikasi'];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.backLink}>← {t('userGuide.backToHome')}</Link>
      </header>
      <main className={styles.main}>
        <h1 className={styles.title}>{t(config.titleKey)}</h1>
        <p className={styles.placeholder}>{t(config.comingSoonKey)}</p>
      </main>
    </div>
  );
}
