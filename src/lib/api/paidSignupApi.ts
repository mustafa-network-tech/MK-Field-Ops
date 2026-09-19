// Paid signup is disabled until a verified server-side payment integration exists.
export const PAID_SIGNUP_NETWORK_ERROR = 'PAID_SIGNUP_NETWORK';

export type CreatePendingSignupInput = {
  full_name: string;
  email: string;
  password: string;
  campaign_name: string;
  campaign_code: string;
};

export type CreatePendingSignupResult = {
  pending_signup_id: string;
  signup_token: string;
};

export type MockPaymentSuccessInput = {
  pending_signup_id: string;
  signup_token: string;
  password: string;
  selected_plan: 'starter' | 'professional' | 'enterprise';
  billing_cycle: 'monthly' | 'yearly';
};

export type MockPaymentSuccessResult = {
  ok: true;
  already_completed: boolean;
  company_id: string;
  user_id: string;
};

export async function createPendingSignupApi(_input: CreatePendingSignupInput): Promise<CreatePendingSignupResult> {
  throw new Error('onboarding.paidSignupDisabled');
}
export async function mockPaymentSuccessApi(_input: MockPaymentSuccessInput): Promise<MockPaymentSuccessResult> {
  throw new Error('onboarding.paidSignupDisabled');
}
