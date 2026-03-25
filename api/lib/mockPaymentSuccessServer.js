import { createClient } from '@supabase/supabase-js';
import { activatePaidSignup } from './activatePaidSignupNode.js';
import { getMockSecret } from './createPendingSignupServer.js';

const PLANS = ['starter', 'professional', 'enterprise'];

/**
 * @returns {{ status: number, body: Record<string, unknown> }}
 */
export async function runMockPaymentSuccess(supabaseUrl, serviceRoleKey, req, payload) {
  const secret = getMockSecret();
  if (secret) {
    const h = String(req.headers?.['x-mock-payment-secret'] ?? '').trim();
    if (h !== secret) {
      return { status: 401, body: { ok: false, error: 'Unauthorized', code: 'unauthorized' } };
    }
  }

  const pending_signup_id = String(payload.pending_signup_id ?? '').trim();
  const signup_token = String(payload.signup_token ?? '').trim();
  const password = String(payload.password ?? '');
  const selected_plan = String(payload.selected_plan ?? '').trim();
  const billing_cycle =
    String(payload.billing_cycle ?? 'monthly').trim() === 'yearly' ? 'yearly' : 'monthly';

  if (!pending_signup_id || !signup_token || !password) {
    return {
      status: 400,
      body: { ok: false, error: 'pending_signup_id, signup_token, and password are required' },
    };
  }
  if (!PLANS.includes(selected_plan)) {
    return { status: 400, body: { ok: false, error: 'Invalid selected_plan' } };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const result = await activatePaidSignup(admin, {
    pendingSignupId: pending_signup_id,
    signupToken: signup_token,
    passwordPlain: password,
    selectedPlan: selected_plan,
    billingCycle: billing_cycle,
  });

  if (!result.ok) {
    const code = result.code ?? 'error';
    const status =
      code === 'invalid_password' || code === 'invalid_token' || code === 'not_found'
        ? 400
        : code === 'in_progress'
          ? 409
          : 500;
    return { status, body: { ok: false, error: result.error, code } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      already_completed: result.alreadyCompleted,
      company_id: result.companyId,
      user_id: result.userId,
    },
  };
}
