-- =============================================================================
-- mk-score 00019 - Super admin read policies
-- =============================================================================
-- Purpose:
--   Allow superAdmin role to read global companies/profiles aggregates and list.
--   No write permission is granted by this migration.
-- =============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select_super_admin ON public.companies;
CREATE POLICY companies_select_super_admin
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role = 'superAdmin'
      AND me.role_approval_status = 'approved'
  )
);

DROP POLICY IF EXISTS profiles_select_super_admin ON public.profiles;
CREATE POLICY profiles_select_super_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role = 'superAdmin'
      AND me.role_approval_status = 'approved'
  )
);
