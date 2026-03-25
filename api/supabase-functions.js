/**
 * Vercel Edge Function: tarayıcı → /api/supabase-functions?fn=… → Supabase Edge.
 * Node (req,res) + "type":"module" kombinasyonu bazen sorun çıkarır; Edge + Request/Response daha tutarlıdır.
 */
export const config = { runtime: 'edge' };

const ALLOWED = new Set(['create-pending-signup', 'mock-payment-success']);

export default async function handler(request) {
  if (request.method === 'GET') {
    return Response.json({ ok: true, name: 'supabase-functions-proxy', runtime: 'edge' });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const url = new URL(request.url);
  const fn = url.searchParams.get('fn') || '';
  if (!ALLOWED.has(fn)) {
    return Response.json({ error: 'Invalid function name' }, { status: 400 });
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
    return Response.json(
      {
        error:
          'Missing Supabase URL or anon key on server (set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY or SUPABASE_URL + SUPABASE_ANON_KEY)',
      },
      { status: 500 }
    );
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
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
    return Response.json(body, { status: r.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: 'Upstream unreachable', detail: msg }, { status: 502 });
  }
}
