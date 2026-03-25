/**
 * Vercel Serverless: tarayıcı → /api/supabase-functions?fn=… → Supabase Edge (CORS / ağ sorunlarını aşar).
 * Ortam: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (Vercel’de Production’da tanımlı olmalı).
 */
const ALLOWED = new Set(['create-pending-signup', 'mock-payment-success']);

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const fn = typeof req.query.fn === 'string' ? req.query.fn : '';
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
  /** @type {Record<string, string>} */
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
  };
  if (mockSecret) headers['x-mock-payment-secret'] = mockSecret;

  const target = `${supabaseUrl}/functions/v1/${fn}`;
  try {
    const r = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body ?? {}),
    });
    const text = await r.text();
    /** @type {unknown} */
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
};
