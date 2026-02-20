/**
 * Global rule for all price fields (Materials price, Work Items unitPrice, etc.):
 * - Non-negative
 * - Finite number
 * - Stored/displayed with 2 decimal places for consistency
 */

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
  const rounded = Math.round(n * Math.pow(10, MAX_DECIMALS)) / Math.pow(10, MAX_DECIMALS);
  return { ok: true, value: rounded };
}

/**
 * Format price for display. Use for all price/unitPrice in tables and UI.
 */
export function formatPrice(value: number): string {
  return Number.isFinite(value) ? value.toFixed(MAX_DECIMALS) : '–';
}

const PRICE_HIDDEN = '----';

/** When 'teamOnly': TL with canSeePrices sees value (their share). When 'companyOrTotal': TL never sees (company share / total). */
export type PriceScope = 'teamOnly' | 'companyOrTotal';

/**
 * Team Leader: can see only their percentage (team earnings) when canSeePrices is granted.
 * TL never sees company share or total work value — always "----".
 * CM/PM see all. TL without canSeePrices sees "----" everywhere.
 */
export function formatPriceForUser(
  value: number,
  user: { role: string; canSeePrices?: boolean } | undefined,
  scope: PriceScope = 'companyOrTotal'
): string {
  if (!user) return formatPrice(value);
  if (user.role !== 'teamLeader') return formatPrice(value);
  if (!user.canSeePrices) return PRICE_HIDDEN;
  if (scope === 'companyOrTotal') return PRICE_HIDDEN;
  return formatPrice(value);
}
