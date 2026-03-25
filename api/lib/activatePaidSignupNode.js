/**
 * Edge _shared/activatePaidSignup.ts ile aynı iş kuralları (Vercel Node).
 */
import { compareSync } from 'bcryptjs';

const PLANS = ['starter', 'professional', 'enterprise'];

function timingSafeEqual(a, b) {
  const ta = new TextEncoder().encode(a);
  const tb = new TextEncoder().encode(b);
  if (ta.length !== tb.length) return false;
  let out = 0;
  for (let i = 0; i < ta.length; i++) out |= ta[i] ^ tb[i];
  return out === 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {{ pendingSignupId: string, signupToken: string, passwordPlain: string, selectedPlan: string, billingCycle: 'monthly'|'yearly' }} params
 */
export async function activatePaidSignup(admin, params) {
  const { pendingSignupId, signupToken, passwordPlain, selectedPlan, billingCycle } = params;

  if (!PLANS.includes(selectedPlan)) {
    return { ok: false, error: 'Invalid plan', code: 'invalid_plan' };
  }

  const { data: row, error: fetchErr } = await admin
    .from('pending_signups')
    .select('*')
    .eq('id', pendingSignupId)
    .maybeSingle();

  if (fetchErr) {
    return { ok: false, error: fetchErr.message, code: 'fetch_failed' };
  }
  if (!row) {
    return { ok: false, error: 'Pending signup not found', code: 'not_found' };
  }

  if (row.status === 'completed' && row.activated_company_id && row.activated_user_id) {
    return {
      ok: true,
      alreadyCompleted: true,
      companyId: row.activated_company_id,
      userId: row.activated_user_id,
    };
  }

  if (row.status === 'processing') {
    return { ok: false, error: 'Activation in progress; try again shortly', code: 'in_progress' };
  }

  if (row.status !== 'pending_payment') {
    return { ok: false, error: 'Invalid pending signup state', code: 'bad_state' };
  }

  const tokenRow = String(row.signup_token ?? '');
  if (!timingSafeEqual(tokenRow, signupToken.trim())) {
    return { ok: false, error: 'Invalid signup token', code: 'invalid_token' };
  }

  try {
    if (!compareSync(passwordPlain, row.password_hash)) {
      return { ok: false, error: 'Invalid password', code: 'invalid_password' };
    }
  } catch {
    return { ok: false, error: 'Invalid password', code: 'invalid_password' };
  }

  const { data: claimed, error: claimErr } = await admin.rpc('try_claim_pending_signup', {
    p_id: pendingSignupId,
  });

  if (claimErr) {
    return { ok: false, error: claimErr.message, code: 'claim_failed' };
  }
  if (claimed !== true) {
    const { data: again } = await admin.from('pending_signups').select('*').eq('id', pendingSignupId).maybeSingle();
    if (again?.status === 'completed' && again.activated_company_id && again.activated_user_id) {
      return {
        ok: true,
        alreadyCompleted: true,
        companyId: again.activated_company_id,
        userId: again.activated_user_id,
      };
    }
    return { ok: false, error: 'Could not claim signup for activation', code: 'claim_conflict' };
  }

  const fullName = String(row.full_name).trim();
  const email = String(row.email).trim().toLowerCase();
  const campaignName = String(row.campaign_name).trim();
  const campaignCode = String(row.campaign_code).trim();

  const cId = crypto.randomUUID();
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 7);
  const planStart = new Date().toISOString();
  const planEndDate = new Date();
  if (billingCycle === 'yearly') planEndDate.setFullYear(planEndDate.getFullYear() + 1);
  else planEndDate.setDate(planEndDate.getDate() + 30);
  const planEnd = planEndDate.toISOString();

  let companyId = null;
  let userId = null;

  try {
    const { error: insCo } = await admin.from('companies').insert({
      id: cId,
      name: campaignName,
      join_code: campaignCode,
      plan: selectedPlan,
      billing_cycle: billingCycle,
      plan_status: 'trial',
      trial_end_date: trialEnd.toISOString().slice(0, 10),
      language_code: 'en',
      created_at: new Date().toISOString(),
      plan_start_date: planStart,
      plan_end_date: planEnd,
    });
    if (insCo) {
      if (String(insCo.message).includes('duplicate') || insCo.code === '23505') {
        throw new Error('company_name_exists');
      }
      throw new Error(insCo.message);
    }
    companyId = cId;

    const { data: authData, error: signUpErr } = await admin.auth.admin.createUser({
      email,
      password: passwordPlain,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        company_id: cId,
        role: 'companyManager',
        role_approval_status: 'approved',
      },
    });

    if (signUpErr) {
      throw signUpErr;
    }
    userId = authData.user?.id ?? null;
    if (!userId) {
      throw new Error('no_user_id');
    }

    await admin.from('companies').update({ owner_user_id: userId }).eq('id', cId);

    const { error: campErr } = await admin.from('campaigns').insert({
      company_id: cId,
      name: campaignName,
      join_code: campaignCode,
    });
    if (campErr) throw campErr;

    if (selectedPlan === 'starter') {
      const { data: defCamp, error: dcErr } = await admin
        .from('campaigns')
        .insert({ company_id: cId, name: 'Default' })
        .select('id')
        .single();
      if (!dcErr && defCamp?.id) {
        const year = new Date().getFullYear();
        await admin.from('projects').insert({
          company_id: cId,
          campaign_id: defCamp.id,
          project_year: year,
          external_project_id: 'STARTER-DEFAULT',
          received_date: new Date().toISOString().slice(0, 10),
          name: 'Default',
          status: 'ACTIVE',
          created_by: userId,
        });
      }
    }

    const { error: doneErr } = await admin
      .from('pending_signups')
      .update({
        status: 'completed',
        activated_company_id: cId,
        activated_user_id: userId,
        selected_plan: selectedPlan,
        billing_cycle: billingCycle,
      })
      .eq('id', pendingSignupId)
      .eq('status', 'processing');

    if (doneErr) throw doneErr;

    return { ok: true, alreadyCompleted: false, companyId: cId, userId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (userId) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        /* ignore */
      }
    }
    if (companyId) {
      try {
        await admin.from('companies').delete().eq('id', companyId);
      } catch {
        /* ignore */
      }
    }
    await admin
      .from('pending_signups')
      .update({ status: 'pending_payment' })
      .eq('id', pendingSignupId)
      .eq('status', 'processing');

    if (msg === 'company_name_exists' || String(msg).includes('23505') || String(msg).includes('duplicate')) {
      return { ok: false, error: 'Company name already exists', code: 'company_name_exists' };
    }
    if (
      String(msg).toLowerCase().includes('already been registered') ||
      String(msg).includes('already registered')
    ) {
      return { ok: false, error: 'Email already registered', code: 'email_exists' };
    }
    return { ok: false, error: msg, code: 'activation_failed' };
  }
}
