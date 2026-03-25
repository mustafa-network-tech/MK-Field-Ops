/**
 * Vercel Serverless — tek dosya `api/*.js` her zaman route olarak algılanır.
 * ESM `export default` (package.json type:module ile uyumlu).
 */
/** Hobby: en fazla 10s; Pro: 60s’e kadar. POST + soğuk Supabase Edge için süre gerekir. */
export const config = { maxDuration: 60 };

const ALLOWED = new Set(['create-pending-signup', 'mock-payment-success']);

function parseBody(req) {
  const b = req.body;
  if (b == null) return {};
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
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return res.status(204).end();
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const fn = typeof req.query?.fn === 'string' ? req.query.fn : '';
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

    const payload = parseBody(req);

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
