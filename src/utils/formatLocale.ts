/**
 * Date and currency formatting by UI locale.
 * tr → DD.MM.YYYY | en → MM/DD/YYYY | es, fr, de → DD/MM/YYYY
 * Currency: tr → TRY (₺) | en → USD ($) | de, fr, es → EUR (€).
 * Number: TR/DE → 1.234,56 | EN → 1,234.56 | ES/FR → 1 234,56
 */

import type { Locale } from '../i18n/I18nContext';

const DATE_LOCALES: Record<Locale, string> = {
  en: 'en-US',
  tr: 'tr-TR',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
};

/** Format date for display. Uses Intl: tr=DD.MM.YYYY, en=MM/DD/YYYY, es/fr/de=DD/MM/YYYY. */
export function formatDate(value: Date | string, locale: Locale): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  const loc = DATE_LOCALES[locale] ?? 'en-US';
  return new Intl.DateTimeFormat(loc, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export type CurrencyInfo = { locale: string; currency: string; symbol: string; code: string };

export const CURRENCY_CONFIG: Record<Locale, CurrencyInfo> = {
  en: { locale: 'en-US', currency: 'USD', symbol: '$', code: 'USD' },
  tr: { locale: 'tr-TR', currency: 'TRY', symbol: '₺', code: 'TRY' },
  es: { locale: 'es-ES', currency: 'EUR', symbol: '€', code: 'EUR' },
  fr: { locale: 'fr-FR', currency: 'EUR', symbol: '€', code: 'EUR' },
  de: { locale: 'de-DE', currency: 'EUR', symbol: '€', code: 'EUR' },
};

/** Get currency for locale (for future manual override: pass override code when implemented). */
export function getCurrencyForLocale(locale: Locale, _override?: string): CurrencyInfo {
  const info = CURRENCY_CONFIG[locale] ?? CURRENCY_CONFIG.en;
  return _override ? { ...info, code: _override } : info;
}

/** Format number as currency. tr → 1.234,56 ₺, en → $1,234.56, de/fr/es → € with locale grouping. */
export function formatCurrency(amount: number, locale: Locale): string {
  const config = CURRENCY_CONFIG[locale] ?? CURRENCY_CONFIG.en;
  return new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: 'currency',
    currency: config.currency,
  }).format(amount);
}

/** Format number with locale-appropriate grouping and decimals (no currency symbol). For PDF/export. */
export function formatNumberByLocale(
  value: number,
  locale: Locale,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const config = CURRENCY_CONFIG[locale] ?? CURRENCY_CONFIG.en;
  return new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(value);
}

/** Round to 2 decimal places for money; avoids floating point display bugs. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export type ParseDecimalResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * Parse user input that may use comma or period as decimal separator.
 * Accepts: "12.50", "12,50", "1.234,56", "1,234.56", "1 234,56".
 * Uses last occurrence of comma or period as decimal separator when both present.
 */
export function parseDecimalFromLocale(str: string, _locale?: Locale): ParseDecimalResult {
  const raw = String(str ?? '').trim().replace(/\s+/g, '');
  if (raw === '') return { ok: false, error: 'validation.required' };
  const lastComma = raw.lastIndexOf(',');
  const lastPeriod = raw.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastPeriod >= 0) {
    const decimalPos = Math.max(lastComma, lastPeriod);
    const grouping = decimalPos === lastComma ? '.' : ',';
    normalized = raw.slice(0, decimalPos).replace(new RegExp(`\\${grouping}`, 'g'), '') + '.' + raw.slice(decimalPos + 1);
  } else if (lastComma >= 0) {
    normalized = raw.replace(/,/g, '.');
  } else if (lastPeriod >= 0) {
    normalized = raw;
  } else {
    normalized = raw;
  }
  const n = Number(normalized);
  if (Number.isNaN(n)) return { ok: false, error: 'validation.invalidNumber' };
  if (!Number.isFinite(n)) return { ok: false, error: 'validation.invalidNumber' };
  return { ok: true, value: roundMoney(n) };
}
