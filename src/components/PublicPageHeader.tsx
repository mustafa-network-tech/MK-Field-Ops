import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import type { Locale } from '../i18n/I18nContext';
import styles from './PublicPageHeader.module.css';

const LOCALES: Locale[] = ['en', 'tr', 'es', 'fr', 'de'];

/**
 * Header for public pages (Gizlilik, Kullanım Şartları, Geri Ödeme, Kullanım Kılavuzu).
 * Shows back link and language selector so the language chosen on the landing page applies here too.
 */
export function PublicPageHeader() {
  const { t, locale, setLocale } = useI18n();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!langOpen) return;
    const close = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [langOpen]);

  return (
    <header className={styles.header}>
      <Link to="/" className={styles.backLink}>← {t('userGuide.backToHome')}</Link>
      <div className={styles.langDropdown} ref={langRef}>
        <button
          type="button"
          className={styles.langTrigger}
          onClick={() => setLangOpen((o) => !o)}
          aria-expanded={langOpen}
          aria-haspopup="listbox"
          aria-label={t('topBar.language')}
        >
          <span aria-hidden>🌐</span>
          <span>{locale.toUpperCase()}</span>
          <span className={styles.langChevron} aria-hidden>{langOpen ? '▴' : '▾'}</span>
        </button>
        {langOpen && (
          <ul className={styles.langMenu} role="listbox">
            {LOCALES.map((loc) => (
              <li key={loc} role="option" aria-selected={locale === loc}>
                <button
                  type="button"
                  className={styles.langOption}
                  onClick={() => {
                    setLocale(loc);
                    setLangOpen(false);
                  }}
                >
                  {loc.toUpperCase()}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
