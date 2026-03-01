-- RLS: Strict multi-tenant isolation. No USING (true). No cross-company access.
-- auth.users = identity; public.profiles = profile (id -> auth.users.id, company_id, role).
-- Admin override only via service_role key.

-- =============================================================================
-- 1. PUBLIC.COMPANIES – Remove always-true (anon) policies
-- =============================================================================
DROP POLICY IF EXISTS companies_select_anon ON public.companies;
DROP POLICY IF EXISTS companies_update_anon ON public.companies;

-- Authenticated policies (created in 20250302000002) remain:
-- companies_select_own: SELECT where id = (SELECT company_id FROM profiles WHERE id = auth.uid())
-- companies_update_cm_pm: UPDATE only for CM/PM and only their company

-- =============================================================================
-- 2. PUBLIC.PROFILES – Only if table exists. Strict CM policy (no WITH CHECK true).
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS profiles_update_cm_same_company ON public.profiles;
    CREATE POLICY profiles_update_cm_same_company ON public.profiles
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- 3. PUBLIC.USERS – If table exists, enable RLS and strict own-row-only policies
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS users_select_own ON public.users;
    CREATE POLICY users_select_own ON public.users
      FOR SELECT TO authenticated
      USING (id = auth.uid()::text);

    DROP POLICY IF EXISTS users_update_own ON public.users;
    CREATE POLICY users_update_own ON public.users
      FOR UPDATE TO authenticated
      USING (id = auth.uid()::text)
      WITH CHECK (id = auth.uid()::text);

    DROP POLICY IF EXISTS users_insert_own ON public.users;
    CREATE POLICY users_insert_own ON public.users
      FOR INSERT TO authenticated
      WITH CHECK (id = auth.uid()::text);

    -- Remove any always-true policies if they exist
    DROP POLICY IF EXISTS users_select_anon ON public.users;
    DROP POLICY IF EXISTS users_update_anon ON public.users;
    DROP POLICY IF EXISTS users_insert_anon ON public.users;
  END IF;
END $$;

-- =============================================================================
-- Summary
-- =============================================================================
-- companies:  SELECT/UPDATE only for authenticated; row must be user's company.
-- profiles:   SELECT/UPDATE own (id = auth.uid()); CM/PM can UPDATE same-company with strict CHECK.
-- users:      If present, SELECT/UPDATE/INSERT only own row (id = auth.uid()).
-- No anon policies with USING (true). Service role bypasses RLS for admin override.
--
-- Note: After this migration, unauthenticated clients cannot read companies. If your
-- "register existing company" flow needs to look up company by id/name before signUp,
-- use an Edge Function or backend with service_role to perform that lookup.
