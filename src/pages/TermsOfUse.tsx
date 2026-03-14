import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { PublicPageHeader } from '../components/PublicPageHeader';
import styles from './TermsOfUse.module.css';

function listItems(t: (key: string) => string, key: string) {
  return t(key)
    .split('\n')
    .filter(Boolean)
    .map((item, i) => <li key={i}>{item}</li>);
}

export function TermsOfUse() {
  const { t } = useI18n();
  const pageTitle = t('landing.footerTerms');

  useEffect(() => {
    document.title = `${pageTitle} | MK-OPS`;
    return () => { document.title = 'MK-OPS'; };
  }, [pageTitle]);

  return (
    <div className={styles.page}>
      <PublicPageHeader />
      <main className={styles.doc}>
        <h1 className={styles.mainTitle}>{pageTitle}</h1>

        <p className={styles.lead}>
          {t('legal.terms.lead')}{' '}
          <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a>
        </p>

        <p>{t('legal.terms.intro')}</p>

        <h2 className={styles.h2}>{t('legal.terms.s1Title')}</h2>
        <p>{t('legal.terms.s1P')}</p>
        <ul className={styles.contactBlock}>
          <li><strong>{t('legal.terms.s1Contact')}</strong></li>
          <li>{t('legal.privacy.emailLabel')} <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a></li>
          <li>{t('legal.privacy.websiteLabel')} <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a></li>
        </ul>

        <h2 className={styles.h2}>{t('legal.terms.s2Title')}</h2>
        <p>{t('legal.terms.s2P')}</p>
        <ul>{listItems(t, 'legal.terms.s2List')}</ul>

        <h2 className={styles.h2}>{t('legal.terms.s3Title')}</h2>
        <p>{t('legal.terms.s3P')}</p>

        <h2 className={styles.h2}>{t('legal.terms.s4Title')}</h2>
        <p>{t('legal.terms.s4P')}</p>
        <ul>{listItems(t, 'legal.terms.s4List')}</ul>

        <h2 className={styles.h2}>{t('legal.terms.s5Title')}</h2>
        <p>{t('legal.terms.s5P1')}</p>
        <p>{t('legal.terms.s5P2')}</p>

        <h2 className={styles.h2}>{t('legal.terms.s6Title')}</h2>
        <p>{t('legal.terms.s6P')}</p>

        <h2 className={styles.h2}>{t('legal.terms.s7Title')}</h2>
        <p>{t('legal.terms.s7P1')}</p>
        <p>
          {t('legal.terms.s7P2Before')}
          <Link to="/geri-odeme-politikasi" className={styles.link}>{t('legal.terms.refundPolicyLink')}</Link>
          {t('legal.terms.s7P2After')}
        </p>

        <h2 className={styles.h2}>{t('legal.terms.s8Title')}</h2>
        <p>{t('legal.terms.s8P1')}</p>
        <ul>{listItems(t, 'legal.terms.s8List')}</ul>
        <p>{t('legal.terms.s8P2')}</p>

        <h2 className={styles.h2}>{t('legal.terms.s9Title')}</h2>
        <p>
          {t('legal.terms.s9P1Before')}
          <Link to="/gizlilik-politikasi" className={styles.link}>{t('legal.terms.privacyPolicyLink')}</Link>
          {t('legal.terms.s9P1After')}
        </p>
        <p>{t('legal.terms.s9P2')}</p>

        <h2 className={styles.h2}>{t('legal.terms.s10Title')}</h2>
        <p>{t('legal.terms.s10P')}</p>

        <h2 className={styles.h2}>{t('legal.terms.s11Title')}</h2>
        <p>{t('legal.terms.s11P')}</p>

        <h2 className={styles.h2}>{t('legal.terms.s12Title')}</h2>
        <p>{t('legal.terms.s12P')}</p>

        <h2 className={styles.h2}>{t('legal.terms.s13Title')}</h2>
        <p>{t('legal.terms.s13P')}</p>
        <ul className={styles.contactBlock}>
          <li>{t('legal.privacy.emailLabel')} <a href="mailto:mustafa82oner@gmail.com" className={styles.link}>mustafa82oner@gmail.com</a></li>
          <li>{t('legal.privacy.websiteLabel')} <a href="https://mk-ops.tr" className={styles.link} rel="noopener noreferrer" target="_blank">https://mk-ops.tr</a></li>
        </ul>
      </main>
    </div>
  );
}
