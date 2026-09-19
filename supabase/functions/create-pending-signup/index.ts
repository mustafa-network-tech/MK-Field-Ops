// Disabled in every environment; no service-role client or secrets are loaded.
Deno.serve(() => new Response(JSON.stringify({
  ok: false, code: 'paid_signup_disabled', error: 'Paid signup is unavailable',
}), { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }));
