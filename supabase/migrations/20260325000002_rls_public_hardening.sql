-- =============================================================================
-- mk-score 00010 - Public schema RLS hardening
-- =============================================================================
-- Problem:
--   Supabase security advisor reports tables in exposed schemas with RLS disabled
--   ("Table publicly accessible" / rls disabled on exposed schema).
--
-- Goal:
--   1) Ensure every user table in public schema has RLS enabled.
--   2) Explicitly lock down onboarding/payment-prep table pending_signups.
--   3) Revoke accidental public execute on SECURITY DEFINER onboarding function.
-- =============================================================================

-- 1) Enable RLS for all regular user tables in public schema.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = false
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schema_name, r.table_name);
  END LOOP;
END $$;

-- 2) Harden pending_signups: service-side only.
ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- Remove any accidental grants from public-facing roles.
REVOKE ALL ON TABLE public.pending_signups FROM PUBLIC;
REVOKE ALL ON TABLE public.pending_signups FROM anon;
REVOKE ALL ON TABLE public.pending_signups FROM authenticated;

-- Keep explicit service access if bypass is not available in some environments.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pending_signups TO service_role;

-- Defense in depth: if any broad policies were created manually, remove them.
DROP POLICY IF EXISTS pending_signups_anon_all ON public.pending_signups;
DROP POLICY IF EXISTS pending_signups_authenticated_all ON public.pending_signups;
DROP POLICY IF EXISTS pending_signups_public_all ON public.pending_signups;

-- 3) SECURITY DEFINER function execute privileges: prevent public execution.
REVOKE ALL ON FUNCTION public.try_claim_pending_signup(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_claim_pending_signup(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.try_claim_pending_signup(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.try_claim_pending_signup(uuid) TO service_role;
