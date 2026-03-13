/**
 * Company settings: fetch/update company from Supabase.
 * Used for company-wide language: fetch on init, update when PM/CM changes language.
 */

import { store } from '../data/store';
import type { CompanyLanguageCode, CompanyPlan } from '../types';
import { supabase } from './supabaseClient';

const VALID_LANGUAGE_CODES: CompanyLanguageCode[] = ['en', 'tr', 'es', 'fr', 'de'];

function normalizeLanguageCode(value: string | null | undefined): CompanyLanguageCode {
  if (value && VALID_LANGUAGE_CODES.includes(value as CompanyLanguageCode)) {
    return value as CompanyLanguageCode;
  }
  return 'en';
}

/**
 * Fetch company row from Supabase and merge language_code (and optionally name, logo_url) into local store.
 * Call on app init when user is set so TL/PM/CM all see company language.
 */
export async function fetchCompanyLanguageFromSupabase(companyId: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('companies')
    .select('language_code, name, logo_url, plan')
    .eq('id', companyId)
    .maybeSingle();
  if (error) {
    console.warn('fetchCompanyLanguageFromSupabase', error);
    return;
  }
  if (!data) return;
  const language_code = normalizeLanguageCode(data.language_code);
  const plan: CompanyPlan | null = data.plan && ['starter', 'professional', 'enterprise'].includes(data.plan) ? (data.plan as CompanyPlan) : null;
  const name = (data.name != null && String(data.name).trim()) ? String(data.name).trim() : 'Company';
  if (!store.getCompany(companyId, companyId)) {
    store.ensureCompany(companyId, name);
  }
  store.updateCompany(companyId, {
    language_code,
    name,
    ...(data.logo_url !== undefined && { logo_url: data.logo_url ?? null }),
    ...(plan != null && { plan }),
  }, companyId);
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
