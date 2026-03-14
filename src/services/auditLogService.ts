/**
 * MVP Audit Log: record "who did what, when" for critical actions.
 * Logs are written to Supabase audit_logs (immutable). Never blocks UX; never throws.
 * Requires Supabase + Auth: actor_user_id must equal auth.uid() for INSERT to succeed.
 * Caller provides actor (id, email, role) from current user; user_agent is set here.
 */

import { supabase } from './supabaseClient';

export type AuditActor = {
  id: string;
  email?: string | null;
  role?: string | null;
};

export type AuditPayload = {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  period_id?: string | null;
  team_code?: string | null;
  project_id?: string | null;
  company_id?: string | null;
  meta?: Record<string, unknown>;
};

function getUserAgent(): string | null {
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    return navigator.userAgent;
  }
  return null;
}

/**
 * Log an audit event. Never blocks; never throws. On failure (e.g. Supabase down, RLS reject) logs to console only.
 * Call after the critical action has already succeeded.
 */
export function logEvent(actor: AuditActor, payload: AuditPayload): void {
  try {
    if (!supabase) return;
    const row = {
      actor_user_id: actor.id,
      actor_email: actor.email ?? null,
      actor_role: actor.role ?? null,
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id ?? null,
      period_id: payload.period_id ?? null,
      team_code: payload.team_code ?? null,
      project_id: payload.project_id ?? null,
      company_id: payload.company_id ?? null,
      user_agent: getUserAgent(),
      meta: payload.meta ?? {},
    };
    void supabase
      .from('audit_logs')
      .insert(row)
      .then(
        ({ error }) => {
          if (error) {
            console.warn('[audit] logEvent failed:', error.message);
          }
        },
        (err: unknown) => {
          console.warn('[audit] logEvent error:', err);
        }
      );
  } catch (err) {
    console.warn('[audit] logEvent exception:', err);
  }
}

/** Helper to build actor from app User type */
export function actorFromUser(user: { id: string; email?: string; role?: string } | undefined): AuditActor | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? null, role: user.role ?? null };
}
