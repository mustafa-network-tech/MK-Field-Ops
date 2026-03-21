/**
 * Client-side entry gate for login/register (not cryptographic security; deters casual access).
 * Override with VITE_SITE_ACCESS_PASSWORD in env; default matches product owner setting.
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

export function verifySiteAccessPassword(input: string): boolean {
  const a = normalizeDigits(input);
  const b = getExpectedAccessPassword();
  return a.length > 0 && a === b;
}
