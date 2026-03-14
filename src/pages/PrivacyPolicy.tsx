import { useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { PublicPageHeader } from '../components/PublicPageHeader';
import styles from './PrivacyPolicy.module.css';

function listItems(t: (key: string) => string, key: string) {
  return t(key)
    .split('\n')
    .filter(Boolean)
    .map((item, i) => <li key={i}>{item}</li>);
}

export function PrivacyPolicy() {
  const { t } = useI18n();
  const pageTitle = t('landing.footerPrivacy');

  useEffect(() => {
    document.title = `${pageTitle} | MK-OPS`;
    return () => { document.title = 'MK-OPS'; };
  }, [pageTitle]);

  return (
    <div className={styles.page}>
      <PublicPageHeader />
      <main className={styles.doc}>
        <h1 className={styles.mainTitle}>{pageTitle}</h1>

        <p className={styles.lead}>{t('legal.privacy.lead')}</p>
        <p>{t('legal.privacy.intro')}</p>

        <h2 className={styles.h2}>{t('legal.privacy.s1Title')}</h2>
        <p>{t('legal.privacy.s1P')}</p>
        <ul className={styles.contactBlock}>
          <li><strong>{t('legal.privacy.s1Contact')}</strong></li>
          <li>{t('legal.privacy.emailLabel')} <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a></li>
          <li>{t('legal.privacy.websiteLabel')} <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a></li>
        </ul>

        <h2 className={styles.h2}>{t('legal.privacy.s2Title')}</h2>
        <p>{t('legal.privacy.s2P')}</p>

        <p className={styles.subHeading}>{t('legal.privacy.s2Account')}</p>
        <ul>{listItems(t, 'legal.privacy.s2AccountList')}</ul>

        <p className={styles.subHeading}>{t('legal.privacy.s2Usage')}</p>
        <ul>{listItems(t, 'legal.privacy.s2UsageList')}</ul>

        <p className={styles.subHeading}>{t('legal.privacy.s2Tech')}</p>
        <ul>{listItems(t, 'legal.privacy.s2TechList')}</ul>

        <p className={styles.subHeading}>{t('legal.privacy.s2Ops')}</p>
        <ul>{listItems(t, 'legal.privacy.s2OpsList')}</ul>

        <p className={styles.subHeading}>{t('legal.privacy.s2Payment')}</p>
        <p>{t('legal.privacy.s2PaymentP')}</p>

        <h2 className={styles.h2}>{t('legal.privacy.s3Title')}</h2>
        <p>{t('legal.privacy.s3P')}</p>
        <ul>{listItems(t, 'legal.privacy.s3List')}</ul>
        <p>{t('legal.privacy.s3NoSell')}</p>

        <h2 className={styles.h2}>{t('legal.privacy.s4Title')}</h2>
        <p>{t('legal.privacy.s4P')}</p>
        <ul>{listItems(t, 'legal.privacy.s4List')}</ul>

        <h2 className={styles.h2}>{t('legal.privacy.s5Title')}</h2>
        <p>{t('legal.privacy.s5P1')}</p>
        <p>{t('legal.privacy.s5P2')}</p>
        <ul>{listItems(t, 'legal.privacy.s5List')}</ul>
        <p>{t('legal.privacy.s5P3')}</p>

        <h2 className={styles.h2}>{t('legal.privacy.s6Title')}</h2>
        <p>{t('legal.privacy.s6P1')}</p>
        <p>{t('legal.privacy.s6P2')}</p>
        <ul>{listItems(t, 'legal.privacy.s6List')}</ul>
        <p>{t('legal.privacy.s6P3')}</p>

        <h2 className={styles.h2}>{t('legal.privacy.s7Title')}</h2>
        <p>{t('legal.privacy.s7P1')}</p>
        <ul>{listItems(t, 'legal.privacy.s7List')}</ul>
        <p>
          {t('legal.privacy.s7P2')}{' '}
          <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a>
        </p>

        <h2 className={styles.h2}>{t('legal.privacy.s8Title')}</h2>
        <p>{t('legal.privacy.s8P1')}</p>
        <ul>{listItems(t, 'legal.privacy.s8List')}</ul>
        <p>{t('legal.privacy.s8P2')}</p>

        <h2 className={styles.h2}>{t('legal.privacy.s9Title')}</h2>
        <p>{t('legal.privacy.s9P1')}</p>
        <p>{t('legal.privacy.s9P2')}</p>

        <h2 className={styles.h2}>{t('legal.privacy.s10Title')}</h2>
        <p>{t('legal.privacy.s10P1')}</p>
        <p>{t('legal.privacy.s10P2')}</p>

        <h2 className={styles.h2}>{t('legal.privacy.s11Title')}</h2>
        <p>{t('legal.privacy.s11P')}</p>
        <ul className={styles.contactBlock}>
          <li><strong>{t('legal.privacy.s1Contact')}</strong></li>
          <li>{t('legal.privacy.emailLabel')} <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a></li>
          <li>{t('legal.privacy.websiteLabel')} <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a></li>
        </ul>
      </main>
    </div>
  );
}
