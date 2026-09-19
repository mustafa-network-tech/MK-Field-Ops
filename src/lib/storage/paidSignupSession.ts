export type PaidSignupSession = {
  v: 1;
  pending_signup_id: string;
  signup_token: string;
  email: string;
  password: string;
  full_name: string;
};

export function clearPaidSignupSession(): void {
  try { sessionStorage.removeItem('mkops_paid_signup_session_v1'); } catch { /* Storage unavailable. */ }
}
export function getPaidSignupSession(): PaidSignupSession | null {
  clearPaidSignupSession();
  return null;
}
export function setPaidSignupSession(_payload: Omit<PaidSignupSession, 'v'>): void {
  clearPaidSignupSession();
  throw new Error('onboarding.paidSignupDisabled');
}
