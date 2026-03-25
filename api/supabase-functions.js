/**
 * Vercel Serverless: tarayıcı → /api/supabase-functions?fn=… → Supabase Edge.
 * Proje "type": "module" olduğu için ESM default export kullanılır (module.exports çalışmaz).
 * Ortam: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */
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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, name: 'supabase-functions-proxy' });
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

  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !anonKey) {
    return res.status(500).json({
      error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY on server',
    });
  }

  const mockSecret = String(process.env.VITE_MOCK_PAYMENT_SECRET || '').trim();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  };
  if (mockSecret) headers['x-mock-payment-secret'] = mockSecret;

  const payload = parseBody(req);
  const target = `${supabaseUrl}/functions/v1/${fn}`;
  try {
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
      body = { error: 'Non-JSON upstream', raw: text.slice(0, 500) };
    }
    return res.status(r.status).json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: 'Upstream unreachable', detail: msg });
  }
}
