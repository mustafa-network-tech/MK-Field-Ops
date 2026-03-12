-- Company-wide language: stored at company level. Only CM/PM can change it.
-- Team Leader: read-only. Company Manager & Project Manager: read + update language_code.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'language_code'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN language_code text NOT NULL DEFAULT 'en';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- companies table created in earlier migration
END $$;

-- Constrain to supported locales
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS chk_companies_language_code;
ALTER TABLE public.companies
  ADD CONSTRAINT chk_companies_language_code
  CHECK (language_code IN ('en', 'tr', 'es', 'fr', 'de'));

COMMENT ON COLUMN public.companies.language_code IS 'Company UI language. Only Company Manager and Project Manager can update.';

-- RLS for companies (if not already enabled)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies so we can recreate conditionally
DROP POLICY IF EXISTS companies_select_own ON public.companies;
DROP POLICY IF EXISTS companies_select_anon_by_id ON public.companies;
DROP POLICY IF EXISTS companies_update_cm_pm ON public.companies;
DROP POLICY IF EXISTS companies_select_anon ON public.companies;
DROP POLICY IF EXISTS companies_update_anon ON public.companies;
-- When public.profiles exists: use role-based policies (authenticated = own company, CM/PM can update)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    CREATE POLICY companies_select_own ON public.companies FOR SELECT TO authenticated
      USING (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
    CREATE POLICY companies_update_cm_pm ON public.companies FOR UPDATE TO authenticated
      USING (
        id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Anon: allow read (fetch company language on app init) and update (persist language when app does not use Supabase Auth)
-- Frontend restricts language change to CM/PM only.
CREATE POLICY companies_select_anon ON public.companies FOR SELECT TO anon USING (true);
CREATE POLICY companies_update_anon ON public.companies FOR UPDATE TO anon USING (true) WITH CHECK (true);
