/**
 * Company settings: fetch/update company from Supabase.
 * Used for company-wide language: fetch on init, update when PM/CM changes language.
 */

import { store } from '../data/store';
import type { CompanyLanguageCode, CompanyPlan } from '../types';
import { isPlanUpgrade } from './subscriptionService';
import { supabase } from './supabaseClient';

const VALID_LANGUAGE_CODES: CompanyLanguageCode[] = ['en', 'tr', 'es', 'fr', 'de'];

/** Ayarlar ekranı ile aynı: 1–28 (DB’de 31’e kadar izin var; senkron sonrası UI ile uyum için sıkıştırılır). */
const PAYROLL_START_DAY_MIN = 1;
const PAYROLL_START_DAY_MAX = 28;

function normalizePayrollStartDayFromDb(raw: unknown): number {
  let n: number;
  if (typeof raw === 'number' && !Number.isNaN(raw)) n = raw;
  else if (raw != null && raw !== '') n = parseInt(String(raw), 10);
  else n = 20;
  if (Number.isNaN(n)) n = 20;
  return Math.min(PAYROLL_START_DAY_MAX, Math.max(PAYROLL_START_DAY_MIN, n));
}

/** Yerel store + companies.payroll_start_day + payroll_period_settings (varsa). */
export async function updatePayrollStartDayInSupabase(
  companyId: string,
  startDayOfMonth: number,
  updatedByProfileId: string
): Promise<{ ok: boolean; error?: string }> {
  if (startDayOfMonth < PAYROLL_START_DAY_MIN || startDayOfMonth > PAYROLL_START_DAY_MAX) {
    return { ok: false, error: 'Invalid payroll start day' };
  }
  if (!supabase) {
    return { ok: true };
  }
  const updatedAt = new Date().toISOString();
  const { error: companyErr } = await supabase
    .from('companies')
    .update({ payroll_start_day: startDayOfMonth })
    .eq('id', companyId);
  if (companyErr) {
    console.warn('updatePayrollStartDayInSupabase companies', companyErr);
    return { ok: false, error: companyErr.message };
  }
  const { error: settingsErr } = await supabase.from('payroll_period_settings').upsert(
    {
      company_id: companyId,
      start_day_of_month: startDayOfMonth,
      updated_by: updatedByProfileId,
      updated_at: updatedAt,
    },
    { onConflict: 'company_id' }
  );
  if (settingsErr) {
    console.warn('updatePayrollStartDayInSupabase payroll_period_settings', settingsErr);
    return { ok: false, error: settingsErr.message };
  }
  return { ok: true };
}

function normalizeLanguageCode(value: string | null | undefined): CompanyLanguageCode {
  if (value && VALID_LANGUAGE_CODES.includes(value as CompanyLanguageCode)) {
    return value as CompanyLanguageCode;
  }
  return 'en';
}

/**
 * Apply pending plan if current period has ended (downgrade takes effect at plan_end_date).
 * Call before fetching company so the next fetch sees the updated plan when due.
 */
export async function applyPendingPlanIfDue(companyId: string): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('apply_pending_plan_if_due', { p_company_id: companyId });
}

/**
 * Fetch company row from Supabase and merge language_code, plan, plan dates, pending_plan into local store.
 * Applies pending plan if due (RPC) before fetch so DB is up to date. Call on app init when user is set.
 */
export async function fetchCompanyLanguageFromSupabase(companyId: string): Promise<void> {
  if (!supabase) return;
  await applyPendingPlanIfDue(companyId);
  const { data, error } = await supabase
    .from('companies')
    .select(
      'language_code, name, logo_url, plan, plan_start_date, plan_end_date, pending_plan, pending_plan_billing_cycle, payroll_start_day, subscription_status, closure_requested_at, purge_after, closed_by_user_id'
    )
    .eq('id', companyId)
    .maybeSingle();
  if (error) {
    console.warn('fetchCompanyLanguageFromSupabase', error);
    return;
  }
  if (!data) return;
  const language_code = normalizeLanguageCode(data.language_code);
  const plan: CompanyPlan | null = data.plan && ['starter', 'professional', 'enterprise'].includes(data.plan) ? (data.plan as CompanyPlan) : null;
  const pending_plan: CompanyPlan | null = data.pending_plan && ['starter', 'professional', 'enterprise'].includes(data.pending_plan) ? (data.pending_plan as CompanyPlan) : null;
  const name = (data.name != null && String(data.name).trim()) ? String(data.name).trim() : 'Company';
  if (!store.getCompany(companyId, companyId)) {
    store.ensureCompany(companyId, name);
  }
  store.updateCompany(companyId, {
    language_code,
    name,
    ...(data.logo_url !== undefined && { logo_url: data.logo_url ?? null }),
    ...(plan != null && { plan }),
    ...(data.plan_start_date !== undefined && { plan_start_date: data.plan_start_date ?? null }),
    ...(data.plan_end_date !== undefined && { plan_end_date: data.plan_end_date ?? null }),
    ...(pending_plan !== undefined && { pending_plan: pending_plan ?? null }),
    ...(data.pending_plan_billing_cycle !== undefined && { pending_plan_billing_cycle: data.pending_plan_billing_cycle ?? null }),
    ...(data.subscription_status !== undefined && { subscription_status: data.subscription_status ?? null }),
    ...(data.closure_requested_at !== undefined && { closure_requested_at: data.closure_requested_at ?? null }),
    ...(data.purge_after !== undefined && { purge_after: data.purge_after ?? null }),
    ...(data.closed_by_user_id !== undefined && { closed_by_user_id: data.closed_by_user_id ?? null }),
  }, companyId);

  /** Hakediş günü: tek kaynak Supabase (companies.payroll_start_day); null → 20. */
  const startDay = normalizePayrollStartDayFromDb(data.payroll_start_day);
  store.setPayrollPeriodSettings(companyId, {
    startDayOfMonth: startDay,
    updatedBy: 'supabase',
  });
}

/**
 * Persist company language to Supabase and update local store.
 * Frontend must restrict this to Company Manager and Project Manager only.
 */
export async function updateCompanyLanguageInSupabase(
  companyId: string,
  language_code: CompanyLanguageCode
): Promise<{ ok: boolean; error?: string }> {
  if (!VALID_LANGUAGE_CODES.includes(language_code)) {
    return { ok: false, error: 'Invalid language code' };
  }
  const updated = store.updateCompany(companyId, { language_code }, companyId);
  if (!updated) return { ok: false, error: 'Company not found' };
  if (!supabase) return { ok: true };
  const { error } = await supabase
    .from('companies')
    .update({ language_code })
    .eq('id', companyId);
  if (error) {
    console.warn('updateCompanyLanguageInSupabase', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Fetch company join code from Supabase. Only Company Manager should call this; used in Settings only.
 * Join code is not merged into store so it is never shown in normal panel UI.
 */
export async function fetchCompanyJoinCodeFromSupabase(companyId: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('companies')
    .select('join_code')
    .eq('id', companyId)
    .maybeSingle();
  if (error || !data) return null;
  return data.join_code ?? null;
}

/**
 * Change company plan (upgrade = immediate; downgrade = at period end).
 * Only CM/PM can update; RLS enforces. Call from plan-change page after "Confirm Plan".
 */
export async function changeCompanyPlanInSupabase(
  companyId: string,
  newPlan: CompanyPlan,
  billingCycle: 'monthly' | 'yearly',
  currentPlan: CompanyPlan | null
): Promise<{ ok: boolean; error?: string }> {
  if (!['starter', 'professional', 'enterprise'].includes(newPlan)) {
    return { ok: false, error: 'Invalid plan' };
  }
  if (!supabase) return { ok: false, error: 'Not connected' };
  const now = new Date();
  const planStart = now.toISOString();
  const planEnd = new Date(now);
  if (billingCycle === 'yearly') planEnd.setFullYear(planEnd.getFullYear() + 1);
  else planEnd.setDate(planEnd.getDate() + 30);
  const planEndIso = planEnd.toISOString();

  if (isPlanUpgrade(currentPlan, newPlan)) {
    const { error } = await supabase
      .from('companies')
      .update({
        plan: newPlan,
        plan_start_date: planStart,
        plan_end_date: planEndIso,
        billing_cycle: billingCycle,
        pending_plan: null,
        pending_plan_billing_cycle: null,
      })
      .eq('id', companyId);
    if (error) return { ok: false, error: error.message };
    store.updateCompany(companyId, {
      plan: newPlan,
      plan_start_date: planStart,
      plan_end_date: planEndIso,
      pending_plan: null,
      pending_plan_billing_cycle: null,
    }, companyId);
  } else {
    const { error } = await supabase
      .from('companies')
      .update({
        pending_plan: newPlan,
        pending_plan_billing_cycle: billingCycle,
      })
      .eq('id', companyId);
    if (error) return { ok: false, error: error.message };
    store.updateCompany(companyId, {
      pending_plan: newPlan,
      pending_plan_billing_cycle: billingCycle,
    }, companyId);
  }
  return { ok: true };
}

/**
 * Renew current plan (extend period). Same plan, new plan_start_date and plan_end_date. Clears pending_plan.
 */
export async function renewCompanyPlanInSupabase(
  companyId: string,
  billingCycle: 'monthly' | 'yearly'
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const now = new Date();
  const planStart = now.toISOString();
  const planEnd = new Date(now);
  if (billingCycle === 'yearly') planEnd.setFullYear(planEnd.getFullYear() + 1);
  else planEnd.setDate(planEnd.getDate() + 30);
  const planEndIso = planEnd.toISOString();
  const { error } = await supabase
    .from('companies')
    .update({
      plan_start_date: planStart,
      plan_end_date: planEndIso,
      billing_cycle: billingCycle,
      pending_plan: null,
      pending_plan_billing_cycle: null,
    })
    .eq('id', companyId);
  if (error) return { ok: false, error: error.message };
  store.updateCompany(companyId, {
    plan_start_date: planStart,
    plan_end_date: planEndIso,
    pending_plan: null,
    pending_plan_billing_cycle: null,
  }, companyId);
  return { ok: true };
}

/**
 * Şirket adı + logo URL (Ayarlar). CM/PM; RLS companies satırını günceller.
 * Logo Storage'a yüklendikten sonra mutlaka çağrılmalı — aksi halde sayfa yenilenince logo kaybolur.
 */
export async function updateCompanyBrandingInSupabase(
  companyId: string,
  payload: { name: string; logo_url: string | null }
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: true };
  const name = (payload.name != null && String(payload.name).trim()) ? String(payload.name).trim() : 'Company';
  const { error } = await supabase
    .from('companies')
    .update({ name, logo_url: payload.logo_url })
    .eq('id', companyId);
  if (error) {
    console.warn('updateCompanyBrandingInSupabase', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Update company join code in Supabase. Only Company Manager; 4 digits only.
 */
export async function updateCompanyJoinCodeInSupabase(
  companyId: string,
  joinCode: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = joinCode.trim();
  if (!/^\d{4}$/.test(trimmed)) {
    return { ok: false, error: 'Join code must be exactly 4 digits.' };
  }
  if (!supabase) return { ok: true };
  const { error } = await supabase
    .from('companies')
    .update({ join_code: trimmed })
    .eq('id', companyId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Company manager requests company closure.
 * Access is blocked immediately and data is retained for 30 days.
 */
export async function requestCompanyClosureInSupabase(companyId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('request_company_closure', { p_company_id: companyId });
  if (error) return { ok: false, error: error.message };
  if (data !== true) return { ok: false, error: 'closure_not_allowed' };
  await fetchCompanyLanguageFromSupabase(companyId);
  return { ok: true };
}

/**
 * Reopen a closed company within retention when there is remaining paid period.
 */
export async function reopenCompanyWithinRetentionInSupabase(companyId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected' };
  const { data, error } = await supabase.rpc('reopen_company_within_retention', { p_company_id: companyId });
  if (error) return { ok: false, error: error.message };
  if (data !== true) return { ok: false, error: 'reopen_not_allowed' };
  await fetchCompanyLanguageFromSupabase(companyId);
  return { ok: true };
}
