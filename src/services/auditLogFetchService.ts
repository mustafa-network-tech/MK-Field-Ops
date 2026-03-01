/**
 * Fetch audit logs from Supabase. RLS applies: CM/PM see all, TL see own.
 * Requires Supabase + Auth session with profiles populated for role-based SELECT.
 */

import { supabase } from './supabaseClient';

export type AuditLogRow = {
  id: string;
  created_at: string;
  actor_user_id: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  period_id: string | null;
  team_code: string | null;
  project_id: string | null;
  user_agent: string | null;
  meta: Record<string, unknown>;
};

const PAGE_SIZE = 50;

export type AuditLogsResult =
  | { ok: true; rows: AuditLogRow[]; total: number }
  | { ok: false; error: string };

export async function fetchAuditLogs(page: number = 0): Promise<AuditLogsResult> {
  try {
    if (!supabase) {
      return { ok: false, error: 'Supabase not configured' };
    }
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: false })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      return { ok: false, error: error.message };
    }
    const rows = (data ?? []) as AuditLogRow[];
    return { ok: true, rows, total: count ?? rows.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export { PAGE_SIZE as AUDIT_LOG_PAGE_SIZE };
