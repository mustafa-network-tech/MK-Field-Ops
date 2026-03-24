import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { hashSync } from 'https://esm.sh/bcryptjs@2.4.3';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mock-payment-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

  const full_name = String(body.full_name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const campaign_name = String(body.campaign_name ?? '').trim();
  const campaign_code = String(body.campaign_code ?? '').trim().replace(/\D/g, '').slice(0, 4);

  if (!full_name || !email || !password || !campaign_name) {
    return json({ error: 'Missing required fields' }, 400);
  }
  if (password.length < 6) {
    return json({ error: 'Password too short' }, 400);
  }
  if (!/^\d{4}$/.test(campaign_code)) {
    return json({ error: 'campaign_code must be 4 digits' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const password_hash = hashSync(password, 10);

  const { data: inserted, error } = await admin
    .from('pending_signups')
    .insert({
      full_name,
      email,
      password_hash,
      campaign_name,
      campaign_code,
    })
    .select('id, signup_token')
    .single();

  if (error) {
    if (error.code === '23505') {
      return json({ error: 'A pending signup already exists for this email' }, 409);
    }
    console.error('[create-pending-signup]', error);
    return json({ error: error.message }, 500);
  }

  return json({
    pending_signup_id: inserted.id,
    signup_token: inserted.signup_token,
  });
});
