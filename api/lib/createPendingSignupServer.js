import { createClient } from '@supabase/supabase-js';
import { hashSync } from 'bcryptjs';

/** Vercel Node: body bazen nesne, string veya Buffer olabilir */
export function parseJsonBody(req) {
  const b = req.body;
  if (b == null) return {};
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8'));
    } catch {
      return {};
    }
  }
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return {};
    }
  }
  if (typeof b === 'object') return b;
  return {};
}

export function getMockSecret() {
  return String(
    process.env.MOCK_PAYMENT_SECRET || process.env.VITE_MOCK_PAYMENT_SECRET || ''
  ).trim();
}

/**
 * Edge create-pending-signup ile aynı doğrulama + insert (service role).
 * @returns {{ status: number, body: Record<string, unknown> }}
 */
export async function runCreatePendingSignup(supabaseUrl, serviceRoleKey, req, payload) {
  const secret = getMockSecret();
  if (secret) {
    const h = String(req.headers?.['x-mock-payment-secret'] ?? '').trim();
    if (h !== secret) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }
  }

  const full_name = String(payload.full_name ?? '').trim();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const password = String(payload.password ?? '');
  const campaign_name = String(payload.campaign_name ?? '').trim();
  const campaign_code = String(payload.campaign_code ?? '')
    .trim()
    .replace(/\D/g, '')
    .slice(0, 4);

  if (!full_name || !email || !password || !campaign_name) {
    return { status: 400, body: { error: 'Missing required fields' } };
  }
  if (password.length < 6) {
    return { status: 400, body: { error: 'Password too short' } };
  }
  if (!/^\d{4}$/.test(campaign_code)) {
    return { status: 400, body: { error: 'campaign_code must be 4 digits' } };
  }

  const password_hash = hashSync(password, 8);
  const admin = createClient(supabaseUrl, serviceRoleKey);

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
      return {
        status: 409,
        body: { error: 'A pending signup already exists for this email' },
      };
    }
    console.error('[create-pending-signup]', error);
    return { status: 500, body: { error: error.message } };
  }

  return {
    status: 200,
    body: {
      pending_signup_id: inserted.id,
      signup_token: inserted.signup_token,
    },
  };
}
