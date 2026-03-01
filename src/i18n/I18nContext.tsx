import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import en from './locales/en.json';
import tr from './locales/tr.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';

export type Locale = 'en' | 'tr' | 'es' | 'fr' | 'de';

const messages: Record<Locale, Record<string, unknown>> = { en, tr, es, fr, de };

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem('locale') as Locale | null;
    const valid: Locale[] = ['en', 'tr', 'es', 'fr', 'de'];
    return saved && valid.includes(saved) ? saved : 'en';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let msg = getNested(messages[locale] as Record<string, unknown>, key);
      if (msg == null && locale !== 'en') {
        msg = getNested(messages.en as Record<string, unknown>, key);
      }
      let out = msg ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }
      return out;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
