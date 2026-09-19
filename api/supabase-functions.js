// Intentionally disabled: no payment proof exists. Never create a service-role client here.
export default async function handler(_req, res) {
  return res.status(503).json({ ok: false, code: 'paid_signup_disabled', error: 'Paid signup is unavailable' });
}
