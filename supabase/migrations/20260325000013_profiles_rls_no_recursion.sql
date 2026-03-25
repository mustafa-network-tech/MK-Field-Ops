-- =============================================================================
-- mk-score 00021 - profiles RLS sonsuz özyineleme düzeltmesi
-- =============================================================================
-- Sorun: profiles üzerindeki politikalar içinde
--   (SELECT ... FROM public.profiles WHERE id = auth.uid())
-- kullanıldığında, aynı tablo için RLS tekrar değerlendirilir ve
-- "infinite recursion detected in policy for relation profiles" hatası oluşur.
-- Çözüm: Mevcut kullanıcı satırını RLS bypass ile okuyan SECURITY DEFINER
-- fonksiyonları; politikalar bu fonksiyonları kullanır.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_profile_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'superAdmin'
      AND p.role_approval_status = 'approved'
  );
$$;

COMMENT ON FUNCTION public.get_my_profile_company_id() IS
  'RLS politikaları için: auth kullanıcısının company_id değeri (özyineleme yok).';
COMMENT ON FUNCTION public.get_my_profile_role() IS
  'RLS politikaları için: auth kullanıcısının role değeri (özyineleme yok).';
COMMENT ON FUNCTION public.get_is_super_admin() IS
  'RLS politikaları için: superAdmin + approved mi (özyineleme yok).';

GRANT EXECUTE ON FUNCTION public.get_my_profile_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_is_super_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- profiles: SELECT politikaları
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_super_admin ON public.profiles;
CREATE POLICY profiles_select_super_admin
ON public.profiles
FOR SELECT
TO authenticated
USING (public.get_is_super_admin());

DROP POLICY IF EXISTS profiles_select_same_company_cm_pm ON public.profiles;
CREATE POLICY profiles_select_same_company_cm_pm
ON public.profiles
FOR SELECT
TO authenticated
USING (
  company_id = public.get_my_profile_company_id()
  AND public.get_my_profile_role() IN ('companyManager', 'projectManager')
);

DROP POLICY IF EXISTS profiles_select_pending_join_cm ON public.profiles;
CREATE POLICY profiles_select_pending_join_cm
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.get_my_profile_role() = 'companyManager'
  AND public.get_my_profile_company_id() IS NOT NULL
  AND id IN (
    SELECT jr.user_id
    FROM public.join_requests jr
    WHERE jr.company_id = public.get_my_profile_company_id()
      AND jr.status = 'pending'
  )
);

-- CM aynı şirkette profil güncelleme (PM kapsamı teams_wipe sonrası pm_scope ile sıkılaşmış olabilir)
DROP POLICY IF EXISTS profiles_update_cm_same_company ON public.profiles;
CREATE POLICY profiles_update_cm_same_company
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  company_id = public.get_my_profile_company_id()
  AND public.get_my_profile_role() = 'companyManager'
)
WITH CHECK (
  company_id = public.get_my_profile_company_id()
  OR company_id IS NULL
);

-- ---------------------------------------------------------------------------
-- companies: SELECT/UPDATE (profiles alt sorgusu özyinelemeye girer)
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_select_super_admin ON public.companies;
CREATE POLICY companies_select_super_admin
ON public.companies
FOR SELECT
TO authenticated
USING (public.get_is_super_admin());

DROP POLICY IF EXISTS companies_select_own ON public.companies;
CREATE POLICY companies_select_own
ON public.companies
FOR SELECT
TO authenticated
USING (id = public.get_my_profile_company_id());

DROP POLICY IF EXISTS companies_update_cm_pm ON public.companies;
CREATE POLICY companies_update_cm_pm
ON public.companies
FOR UPDATE
TO authenticated
USING (
  id = public.get_my_profile_company_id()
  AND public.get_my_profile_role() IN ('companyManager', 'projectManager')
)
WITH CHECK (id = public.get_my_profile_company_id());
