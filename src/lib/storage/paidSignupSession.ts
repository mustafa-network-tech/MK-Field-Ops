/**
 * Browser session for Supabase paid-signup path (pending_signups row + secrets until Pay).
 * Not used when Supabase is disabled (local registerNewCompany flow).
 */
const KEY = 'mkops_paid_signup_session_v1';

export type PaidSignupSession = {
  v: 1;
  pending_signup_id: string;
  signup_token: string;
  email: string;
  password: string;
  full_name: string;
};

export function setPaidSignupSession(session: Omit<PaidSignupSession, 'v'>): void {
  const data: PaidSignupSession = { v: 1, ...session };
  sessionStorage.setItem(KEY, JSON.stringify(data));
}

export function getPaidSignupSession(): PaidSignupSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<PaidSignupSession>;
    if (o.v !== 1 || !o.pending_signup_id || !o.signup_token || !o.email || !o.password) return null;
    return o as PaidSignupSession;
  } catch {
    return null;
  }
}

export function clearPaidSignupSession(): void {
  sessionStorage.removeItem(KEY);
}
