import { useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { PublicPageHeader } from '../components/PublicPageHeader';
import styles from './RefundPolicy.module.css';

function listItems(t: (key: string) => string, key: string) {
  return t(key)
    .split('\n')
    .filter(Boolean)
    .map((item, i) => <li key={i}>{item}</li>);
}

export function RefundPolicy() {
  const { t } = useI18n();
  const pageTitle = t('landing.footerRefund');

  useEffect(() => {
    document.title = `${pageTitle} | MK-OPS`;
    return () => { document.title = 'MK-OPS'; };
  }, [pageTitle]);

  return (
    <div className={styles.page}>
      <PublicPageHeader />
      <main className={styles.doc}>
        <h1 className={styles.mainTitle}>{pageTitle}</h1>

        <p className={styles.lead}>{t('legal.refund.lead')}</p>
        <p>{t('legal.refund.intro')}</p>

        <h2 className={styles.h2}>{t('legal.refund.s1Title')}</h2>
        <p>{t('legal.refund.s1P1')}</p>
        <p>{t('legal.refund.s1P2')}</p>
        <p>{t('legal.refund.s1P3')}</p>

        <h2 className={styles.h2}>{t('legal.refund.s2Title')}</h2>
        <p>{t('legal.refund.s2P1')}</p>
        <p>{t('legal.refund.s2P2')}</p>

        <h2 className={styles.h2}>{t('legal.refund.s3Title')}</h2>
        <p>{t('legal.refund.s3P1')}</p>
        <p>{t('legal.refund.s3P2')}</p>
        <ul>{listItems(t, 'legal.refund.s3List')}</ul>
        <p>{t('legal.refund.s3P3')}</p>

        <h2 className={styles.h2}>{t('legal.refund.s4Title')}</h2>
        <p>{t('legal.refund.s4P')}</p>
        <ul className={styles.contactBlock}>
          <li><strong>{t('legal.refund.contactName')}</strong></li>
          <li>{t('legal.privacy.emailLabel')} <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a></li>
          <li>{t('legal.privacy.websiteLabel')} <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a></li>
        </ul>
      </main>
    </div>
  );
}
