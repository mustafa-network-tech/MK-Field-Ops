-- Ensure public.companies has minimal RLS policies so INSERT does not fail silently.
-- Run this if you have "RLS enabled but no policies" (all operations denied).
-- Company creation at signup runs as anon (before signUp), so anon needs INSERT.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 1) INSERT: anon can insert (signup flow creates company before auth)
DROP POLICY IF EXISTS companies_insert_anon ON public.companies;
CREATE POLICY companies_insert_anon ON public.companies
  FOR INSERT TO anon
  WITH CHECK (true);

-- 2) SELECT: authenticated user can only see their own company (requires profiles)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP POLICY IF EXISTS companies_select_own ON public.companies;
    CREATE POLICY companies_select_own ON public.companies
      FOR SELECT TO authenticated
      USING (id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- 3) UPDATE: authenticated CM/PM can update only their company
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP POLICY IF EXISTS companies_update_cm_pm ON public.companies;
    CREATE POLICY companies_update_cm_pm ON public.companies
      FOR UPDATE TO authenticated
      USING (
        id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;
