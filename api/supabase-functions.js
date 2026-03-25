/**
 * Vercel Serverless — mock-payment-success → Supabase Edge proxy.
 * create-pending-signup: ayrıca /api/create-pending-signup kullanın (paidSignupApi).
 */
import { runCreatePendingSignup, parseJsonBody } from './lib/createPendingSignupServer.js';

/** Hobby: 10; Pro: 60’a kadar. mock-payment Edge proxy için süre. */
export const config = { maxDuration: 60 };

const ALLOWED = new Set(['create-pending-signup', 'mock-payment-success']);

function getFnFromReq(req) {
  const q = req.query;
  if (q && typeof q.fn === 'string' && q.fn) return q.fn;
  try {
    const raw = typeof req.url === 'string' && req.url ? req.url : '/';
    const u = new URL(raw, 'http://localhost');
    const v = u.searchParams.get('fn');
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

function sendJson(res, status, obj) {
  try {
    return res.status(status).setHeader('Content-Type', 'application/json').send(JSON.stringify(obj));
  } catch {
    return res.status(status).send(JSON.stringify({ error: 'Proxy response serialization failed' }));
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, name: 'supabase-functions-proxy', runtime: 'nodejs-esm' });
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

    const fn = getFnFromReq(req);
    if (!ALLOWED.has(fn)) {
      return res.status(400).json({ error: 'Invalid function name' });
    }

    const supabaseUrl = String(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    )
      .trim()
      .replace(/\/$/, '');
    const anonKey = String(
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    ).trim();

    if (!supabaseUrl || !anonKey) {
      return res.status(500).json({
        error:
          'Missing Supabase URL or anon key on server (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY or SUPABASE_URL + SUPABASE_ANON_KEY)',
      });
    }

    const payload = parseJsonBody(req);

    const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (fn === 'create-pending-signup' && serviceRoleKey) {
      const out = await runCreatePendingSignup(supabaseUrl, serviceRoleKey, req, payload);
      return sendJson(res, out.status, out.body);
    }

    const mockSecret = String(
      process.env.VITE_MOCK_PAYMENT_SECRET || process.env.MOCK_PAYMENT_SECRET || ''
    ).trim();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    };
    if (mockSecret) headers['x-mock-payment-secret'] = mockSecret;

    const target = `${supabaseUrl}/functions/v1/${fn}`;
    const r = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = {
        error: 'Non-JSON upstream',
        status: r.status,
        raw: text.slice(0, 800),
      };
    }
    return sendJson(res, r.status, body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Proxy internal error', detail: msg });
    }
  }
}
