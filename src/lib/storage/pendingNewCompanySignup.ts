export type PendingNewCompanyPayload = {
  v: 1;
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  joinCode: string;
};

export function clearPendingNewCompanySignup(): void {
  try { sessionStorage.removeItem('mkfieldops_pending_new_company_v1'); } catch { /* Storage unavailable. */ }
}
export function getPendingNewCompanySignup(): PendingNewCompanyPayload | null {
  clearPendingNewCompanySignup();
  return null;
}
export function setPendingNewCompanySignup(_payload: Omit<PendingNewCompanyPayload, 'v'>): void {
  clearPendingNewCompanySignup();
  throw new Error('onboarding.paidSignupDisabled');
}
