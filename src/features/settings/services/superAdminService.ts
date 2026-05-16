import { supabase } from '@/lib/supabase/supabaseClient';

export type SuperAdminCompanyUser = {
  id: string;
  company_id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  role_approval_status: string;
};

export type SuperAdminDeleteCompanyResult =
  | { ok: true; detachedUsers: number }
  | { ok: false; error: string };

export async function deleteCompanyAsSuperAdmin(companyId: string): Promise<SuperAdminDeleteCompanyResult> {
  if (!supabase) return { ok: false, error: 'no_supabase' };

  const { data, error } = await supabase.rpc('super_admin_delete_company', {
    p_company_id: companyId,
  });

  if (error) return { ok: false, error: error.message };

  const row = data as { ok?: boolean; error?: string; detached_users?: number } | null;
  if (!row?.ok) {
    return { ok: false, error: row?.error ?? 'delete_failed' };
  }

  return { ok: true, detachedUsers: row.detached_users ?? 0 };
}

export type SetCompanyUserLimitResult =
  | { ok: true; maxUsers: number; maxUsersOverride: number | null }
  | { ok: false; error: string };

export async function setCompanyUserLimitAsSuperAdmin(
  companyId: string,
  maxUsers: number | null
): Promise<SetCompanyUserLimitResult> {
  if (!supabase) return { ok: false, error: 'no_supabase' };

  const { data, error } = await supabase.rpc('super_admin_set_company_user_limit', {
    p_company_id: companyId,
    p_max_users: maxUsers,
  });

  if (error) return { ok: false, error: error.message };

  const row = data as {
    ok?: boolean;
    error?: string;
    max_users?: number;
    max_users_override?: number | null;
  } | null;

  if (!row?.ok) {
    return { ok: false, error: row?.error ?? 'update_failed' };
  }

  return {
    ok: true,
    maxUsers: row.max_users ?? maxUsers ?? 0,
    maxUsersOverride: row.max_users_override ?? null,
  };
}

export type SetCompanyUsagePeriodResult =
  | {
      ok: true;
      usagePeriodDays: number | null;
      usagePeriodStartedAt: string | null;
      usageExpiresAt: string | null;
    }
  | { ok: false; error: string };

export async function setCompanyUsagePeriodAsSuperAdmin(
  companyId: string,
  days: number | null
): Promise<SetCompanyUsagePeriodResult> {
  if (!supabase) return { ok: false, error: 'no_supabase' };

  const { data, error } = await supabase.rpc('super_admin_set_company_usage_period', {
    p_company_id: companyId,
    p_days: days,
  });

  if (error) return { ok: false, error: error.message };

  const row = data as {
    ok?: boolean;
    error?: string;
    usage_period_days?: number | null;
    usage_period_started_at?: string | null;
    usage_expires_at?: string | null;
  } | null;

  if (!row?.ok) {
    return { ok: false, error: row?.error ?? 'update_failed' };
  }

  return {
    ok: true,
    usagePeriodDays: row.usage_period_days ?? null,
    usagePeriodStartedAt: row.usage_period_started_at ?? null,
    usageExpiresAt: row.usage_expires_at ?? null,
  };
}
