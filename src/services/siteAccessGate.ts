/**
 * In-app access code for reaching auth pages (not cryptographic security).
 * Override with VITE_SITE_ACCESS_PASSWORD at build time; default 334480. Spaces ignored when typing.
 */
const STORAGE_KEY = 'mkfieldops_entry_unlocked';

const DEFAULT_PASSWORD = '334480';

function normalizeDigits(value: string): string {
  return value.replace(/\s/g, '');
}

export function getExpectedAccessPassword(): string {
  const fromEnv = (import.meta.env.VITE_SITE_ACCESS_PASSWORD as string | undefined)?.trim();
  return normalizeDigits(fromEnv || DEFAULT_PASSWORD);
}

export function isSiteAccessUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSiteAccessUnlocked(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Optional: clear so the access code is asked again (e.g. after logout). Not used by authService. */
export function clearSiteAccessLock(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

export function verifySiteAccessPassword(input: string): boolean {
  const a = normalizeDigits(input);
  const b = getExpectedAccessPassword();
  return a.length > 0 && a === b;
}
