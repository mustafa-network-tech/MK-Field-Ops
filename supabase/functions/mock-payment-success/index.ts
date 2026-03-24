import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { activatePaidSignup, type PlanKey } from '../_shared/activatePaidSignup.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mock-payment-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const PLANS: PlanKey[] = ['starter', 'professional', 'enterprise'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const secret = Deno.env.get('MOCK_PAYMENT_SECRET');
  if (secret) {
    const h = req.headers.get('x-mock-payment-secret');
    if (h !== secret) return json({ error: 'Unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const pending_signup_id = String(body.pending_signup_id ?? '').trim();
  const signup_token = String(body.signup_token ?? '').trim();
  const password = String(body.password ?? '');
  const selected_plan = String(body.selected_plan ?? '').trim() as PlanKey;
  const billing_cycle = (String(body.billing_cycle ?? 'monthly').trim() === 'yearly' ? 'yearly' : 'monthly') as
    | 'monthly'
    | 'yearly';

  if (!pending_signup_id || !signup_token || !password) {
    return json({ error: 'pending_signup_id, signup_token, and password are required' }, 400);
  }
  if (!PLANS.includes(selected_plan)) {
    return json({ error: 'Invalid selected_plan' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const result = await activatePaidSignup(admin, {
    pendingSignupId: pending_signup_id,
    signupToken: signup_token,
    passwordPlain: password,
    selectedPlan: selected_plan,
    billingCycle: billing_cycle,
  });

  if (!result.ok) {
    const code = result.code ?? 'error';
    const status = code === 'invalid_password' || code === 'invalid_token' || code === 'not_found' ? 400 : code === 'in_progress' ? 409 : 500;
    return json({ ok: false, error: result.error, code }, status);
  }

  return json({
    ok: true,
    already_completed: result.alreadyCompleted,
    company_id: result.companyId,
    user_id: result.userId,
  });
});
