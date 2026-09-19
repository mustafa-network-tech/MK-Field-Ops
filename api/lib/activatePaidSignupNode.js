// Defense in depth for any old internal caller; never touches the supplied admin client.
export async function activatePaidSignup() {
  return { ok: false, code: 'paid_signup_disabled', error: 'Paid signup is unavailable' };
}
