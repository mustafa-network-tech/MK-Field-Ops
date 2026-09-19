// No activation or credential collection until payments can be verified.
export async function runMockPaymentSuccess() {
  return { status: 503, body: { ok: false, code: 'paid_signup_disabled', error: 'Paid signup is unavailable' } };
}
