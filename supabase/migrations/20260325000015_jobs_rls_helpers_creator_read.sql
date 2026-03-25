-- =============================================================================
-- mk-score — jobs RLS: profiles alt sorgusu + görünürlük
-- =============================================================================
-- Sorunlar:
-- 1) jobs_company_or_leader politikası profiles üzerinde tekrarlayan SELECT kullanır;
--    00013 sonrası tutarlılık ve plan farkları için get_my_profile_* tercih edilir.
-- 2) profiles.role NULL iken şirket sahibi (owner_user_id) CM yetkisi alamaz; iş
--    kaydı / yenileme sonrası liste boş kalabilir.
-- 3) Oturum açılınca fetch tüm şirket işlerini DB cevabıyla değiştirir; kullanıcı
--    kendi oluşturduğu satırı SELECT ile göremezse kayıt "silinmiş" gibi olur.
--
-- Çözüm: USING/WITH CHECK içinde get_my_profile_company_id / get_my_profile_role;
-- şirket sahibi yazma (INSERT/UPDATE) ve okuma; okumada ayrıca created_by = auth.uid().
-- Önkoşul: 20260325000013_profiles_rls_no_recursion.sql
-- =============================================================================

DROP POLICY IF EXISTS jobs_company_or_leader ON public.jobs;

CREATE POLICY jobs_company_or_leader
ON public.jobs
FOR ALL
TO authenticated
USING (
  company_id IS NOT DISTINCT FROM public.get_my_profile_company_id()
  AND (
    public.get_my_profile_role() IN ('companyManager', 'projectManager')
    OR EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_id
        AND t.company_id = jobs.company_id
        AND t.leader_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_user_id = auth.uid()
    )
    OR created_by = auth.uid()
  )
)
WITH CHECK (
  company_id IS NOT DISTINCT FROM public.get_my_profile_company_id()
  AND (
    public.get_my_profile_role() IN ('companyManager', 'projectManager')
    OR EXISTS (
      SELECT 1
      FROM public.teams t
      WHERE t.id = team_id
        AND t.company_id = jobs.company_id
        AND t.leader_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = company_id
        AND c.owner_user_id = auth.uid()
    )
  )
);

COMMENT ON POLICY jobs_company_or_leader ON public.jobs IS
  'Şirket işleri: CM/PM, ilgili ekibin lideri, şirket sahibi (owner); okumada ayrıca kayıt oluşturan.';
