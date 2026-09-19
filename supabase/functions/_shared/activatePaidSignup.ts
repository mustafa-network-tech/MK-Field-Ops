// No payment provider verification exists. Activation is intentionally unavailable.
export async function activatePaidSignup(_admin?: unknown, _params?: unknown) {
  return { ok: false as const, code: 'paid_signup_disabled', error: 'Paid signup is unavailable' };
}
