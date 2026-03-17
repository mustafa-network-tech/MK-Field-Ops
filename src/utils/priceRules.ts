/**
 * Global rule for all price fields (Materials price, Work Items unitPrice, etc.):
 * - Non-negative, finite, 2 decimal places for money
 * - Display uses locale-aware currency (formatPriceForUser with locale)
 */

import { formatCurrency, roundMoney, parseDecimalFromLocale, type ParseDecimalResult } from './formatLocale';
import type { Locale } from '../i18n/I18nContext';

const MAX_DECIMALS = 2;

export type PriceValidationResult = { ok: true; value: number } | { ok: false; error: string };

/**
 * Validates a price value. Use before save for any price/unitPrice field.
 */
export function validatePrice(raw: unknown): PriceValidationResult {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isNaN(n)) {
    return { ok: false, error: 'validation.invalidNumber' };
  }
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'validation.invalidNumber' };
  }
  if (n < 0) {
    return { ok: false, error: 'validation.positiveNumber' };
  }
  return { ok: true, value: roundMoney(n) };
}

/**
 * Format price as plain number (2 decimals). Prefer formatPriceForUser with locale for UI.
 */
export function formatPrice(value: number): string {
  return Number.isFinite(value) ? roundMoney(value).toFixed(MAX_DECIMALS) : '–';
}

const PRICE_HIDDEN = '----';

/** When 'teamOnly': TL with canSeePrices sees value (their share). When 'companyOrTotal': TL never sees (company share / total). */
export type PriceScope = 'teamOnly' | 'companyOrTotal';

/**
 * Team Leader: can see only their percentage (team earnings) when canSeePrices is granted.
 * TL never sees company share or total work value — always "----".
 * CM/PM see all. TL without canSeePrices sees "----" everywhere.
 * When locale is provided, visible values are formatted as currency (symbol + locale grouping).
 */
export function formatPriceForUser(
  value: number,
  user: { role?: string; canSeePrices?: boolean } | undefined,
  scope: PriceScope = 'companyOrTotal',
  locale: Locale = 'en'
): string {
  if (!user) return formatCurrency(value, locale);
  if (user.role !== 'teamLeader') return formatCurrency(value, locale);
  if (!user.canSeePrices) return PRICE_HIDDEN;
  if (scope === 'companyOrTotal') return PRICE_HIDDEN;
  return formatCurrency(value, locale);
}

/**
 * Format unit price for display. Team Leader sees only their share (unitPrice × teamPercentage/100); CM/PM see full.
 * Use when showing "unit price" so TL sees the amount in their percentage segment.
 */
export function formatUnitPriceForUser(
  unitPrice: number,
  user: { role?: string; canSeePrices?: boolean } | undefined,
  teamPercentage: number | undefined,
  locale: Locale = 'en'
): string {
  if (!user) return formatCurrency(unitPrice, locale);
  if (user.role !== 'teamLeader') return formatCurrency(unitPrice, locale);
  if (!user.canSeePrices) return PRICE_HIDDEN;
  if (teamPercentage == null) return PRICE_HIDDEN;
  const teamShareUnitPrice = roundMoney(unitPrice * (teamPercentage / 100));
  return formatCurrency(teamShareUnitPrice, locale);
}

/** Parse user input for price/quantity: accepts "12,50" or "12.50". Returns rounded value for money. */
export function parseDecimalInput(str: string, locale?: Locale): ParseDecimalResult {
  return parseDecimalFromLocale(str, locale);
}
