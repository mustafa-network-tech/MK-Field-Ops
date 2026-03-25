/**
 * Vercel: mock ödeme sonrası şirket + kullanıcı aktivasyonu (Edge yok).
 */
import { createClient } from '@supabase/supabase-js';
import { activatePaidSignup } from './lib/activatePaidSignupNode.js';
import { getMockSecret, parseJsonBody } from './lib/createPendingSignupServer.js';

export const config = { maxDuration: 60 };

const PLANS = new Set(['starter', 'professional', 'enterprise']);

function sendJson(res, status, obj) {
  try {
    return res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(obj));
  } catch {
    return res.status(status).send(JSON.stringify({ error: 'Response serialization failed' }));
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, route: 'mock-payment-success' });
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-mock-payment-secret');
      return res.status(204).end();
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const secret = getMockSecret();
    if (secret) {
      const h = String(req.headers?.['x-mock-payment-secret'] ?? '').trim();
      if (h !== secret) {
        return sendJson(res, 401, { error: 'Unauthorized' });
      }
    }

    const supabaseUrl = String(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    )
      .trim()
      .replace(/\/$/, '');
    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl) {
      return sendJson(res, 500, {
        error: 'Missing Supabase URL on server (SUPABASE_URL or VITE_SUPABASE_URL)',
      });
    }
    if (!serviceRoleKey) {
      return sendJson(res, 500, {
        error:
          'Missing SUPABASE_SERVICE_ROLE_KEY on Vercel. Supabase → Settings → API → service_role. Add env and redeploy.',
      });
    }

    const body = parseJsonBody(req);
    const pending_signup_id = String(body.pending_signup_id ?? '').trim();
    const signup_token = String(body.signup_token ?? '').trim();
    const password = String(body.password ?? '');
    const selected_plan = String(body.selected_plan ?? '').trim();
    const billing_cycle =
      String(body.billing_cycle ?? 'monthly').trim() === 'yearly' ? 'yearly' : 'monthly';

    if (!pending_signup_id || !signup_token || !password) {
      return sendJson(res, 400, {
        error: 'pending_signup_id, signup_token, and password are required',
      });
    }
    if (!PLANS.has(selected_plan)) {
      return sendJson(res, 400, { error: 'Invalid selected_plan' });
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
      return sendJson(res, status, { ok: false, error: result.error, code });
    }

    return sendJson(res, 200, {
      ok: true,
      already_completed: result.alreadyCompleted,
      company_id: result.companyId,
      user_id: result.userId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'mock-payment-success server error', detail: msg });
    }
  }
}
