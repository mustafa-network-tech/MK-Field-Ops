/**
 * Edge Functions: create-pending-signup, mock-payment-success.
 * Later Paddle webhook can call the same activatePaidSignup logic on the server.
 */

const MOCK_SECRET = (import.meta.env.VITE_MOCK_PAYMENT_SECRET as string | undefined)?.trim();

/** Workspace/i18n: ağ veya CORS; tarayıcı genelde "Failed to fetch" döner */
export const PAID_SIGNUP_NETWORK_ERROR = 'PAID_SIGNUP_NETWORK';

function functionsBaseUrl(): string | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/functions/v1`;
}

async function postFunction(name: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const base = functionsBaseUrl();
  if (!base) throw new Error('Supabase URL not configured');
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!anon) throw new Error('Supabase anon key not configured');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anon}`,
    apikey: anon,
  };
  if (MOCK_SECRET) headers['x-mock-payment-secret'] = MOCK_SECRET;

  let res: Response;
  try {
    res = await fetch(`${base}/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(PAID_SIGNUP_NETWORK_ERROR);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = typeof data.error === 'string' ? data.error : res.statusText;
    throw new Error(err || `HTTP ${res.status}`);
  }
  return data;
}

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

export async function createPendingSignupApi(input: CreatePendingSignupInput): Promise<CreatePendingSignupResult> {
  const data = await postFunction('create-pending-signup', {
    full_name: input.full_name,
    email: input.email,
    password: input.password,
    campaign_name: input.campaign_name,
    campaign_code: input.campaign_code,
  });
  const pending_signup_id = String(data.pending_signup_id ?? '');
  const signup_token = String(data.signup_token ?? '');
  if (!pending_signup_id || !signup_token) throw new Error('Invalid response from create-pending-signup');
  return { pending_signup_id, signup_token };
}

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

export async function mockPaymentSuccessApi(input: MockPaymentSuccessInput): Promise<MockPaymentSuccessResult> {
  const data = await postFunction('mock-payment-success', {
    pending_signup_id: input.pending_signup_id,
    signup_token: input.signup_token,
    password: input.password,
    selected_plan: input.selected_plan,
    billing_cycle: input.billing_cycle,
  });
  return {
    ok: true,
    already_completed: Boolean(data.already_completed),
    company_id: String(data.company_id ?? ''),
    user_id: String(data.user_id ?? ''),
  };
}
