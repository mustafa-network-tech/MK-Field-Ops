/**
 * Vercel: mock ödeme sonrası şirket + kullanıcı aktivasyonu (Edge yok).
 */
import { parseJsonBody } from './lib/createPendingSignupServer.js';
import { runMockPaymentSuccess } from './lib/mockPaymentSuccessServer.js';

/** Pro: aktivasyon birkaç RPC/insert içerir */
export const config = { maxDuration: 60 };

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

    const payload = parseJsonBody(req);
    const out = await runMockPaymentSuccess(supabaseUrl, serviceRoleKey, req, payload);
    return sendJson(res, out.status, out.body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'mock-payment-success server error', detail: msg });
    }
  }
}
