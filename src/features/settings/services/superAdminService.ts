import { supabase } from '@/lib/supabase/supabaseClient';

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
