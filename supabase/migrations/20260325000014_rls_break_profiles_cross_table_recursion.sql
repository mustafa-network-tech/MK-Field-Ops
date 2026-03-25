-- =============================================================================
-- mk-score 00022 — profiles RLS: çapraz tablo özyinelemesi (join_requests + payroll)
-- =============================================================================
-- 00013 ile profiles/companies politikaları helper fonksiyonlara geçti; ancak
-- profiles_select_pending_join_cm içinde join_requests taranırken
-- join_requests RLS hâlâ (SELECT ... FROM profiles WHERE id = auth.uid())
-- kullanıyorsa PostgreSQL tekrar profiles RLS değerlendirir → sonsuz özyineleme.
-- Aynı risk: payroll_period_settings / payroll_periods politikaları mutation
-- sırasında profiles okurken beklenmedik birleşimler.
--
-- Önkoşul: 20260325000013_profiles_rls_no_recursion.sql (get_my_profile_* fonksiyonları)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- join_requests: profiles alt sorgusu kaldır
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS join_requests_select_cm_pm ON public.join_requests;
CREATE POLICY join_requests_select_cm_pm
ON public.join_requests
FOR SELECT
TO authenticated
USING (
  company_id = public.get_my_profile_company_id()
  AND public.get_my_profile_role() IN ('companyManager', 'projectManager')
);

DROP POLICY IF EXISTS join_requests_update_cm ON public.join_requests;
CREATE POLICY join_requests_update_cm
ON public.join_requests
FOR UPDATE
TO authenticated
USING (
  company_id = public.get_my_profile_company_id()
  AND public.get_my_profile_role() = 'companyManager'
)
WITH CHECK (
  company_id = public.get_my_profile_company_id()
);

-- ---------------------------------------------------------------------------
-- payroll_period_settings / payroll_periods: profiles alt sorgusu kaldır
-- (pm_scope sonrası iki ayrı policy; eski tek policy adı da temizlenir)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payroll_period_settings'
  ) THEN
    ALTER TABLE public.payroll_period_settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS payroll_period_settings_company ON public.payroll_period_settings;
    DROP POLICY IF EXISTS payroll_period_settings_select_company ON public.payroll_period_settings;
    DROP POLICY IF EXISTS payroll_period_settings_mutate_cm_only ON public.payroll_period_settings;

    CREATE POLICY payroll_period_settings_select_company ON public.payroll_period_settings
      FOR SELECT TO authenticated
      USING (company_id = public.get_my_profile_company_id());

    CREATE POLICY payroll_period_settings_mutate_cm_only ON public.payroll_period_settings
      FOR ALL TO authenticated
      USING (
        company_id = public.get_my_profile_company_id()
        AND public.get_my_profile_role() = 'companyManager'
      )
      WITH CHECK (
        company_id = public.get_my_profile_company_id()
        AND public.get_my_profile_role() = 'companyManager'
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payroll_periods'
  ) THEN
    ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS payroll_periods_company ON public.payroll_periods;

    CREATE POLICY payroll_periods_company ON public.payroll_periods
      FOR ALL TO authenticated
      USING (company_id = public.get_my_profile_company_id())
      WITH CHECK (company_id = public.get_my_profile_company_id());
  END IF;
END $$;
