-- =============================================================================
-- mk-score — user limit: sadece onayli kullanicilar sayilsin
-- =============================================================================
-- Sorun:
--   Sirket hic onayli kullaniciya sahip degilken bile "limit dolu" hatasi alinabiliyor.
--   Onceki kural pending join_requests satirlarini da kota icine aliyordu.
--
-- Yeni kural:
--   - Kota = yalnizca role_approval_status = 'approved' olan profil sayisi
--   - superAdmin kullanicilar kota disi (company_id zaten NULL olmali)
--   - Onay (approve_join_request) aninda limit denetimi devam eder
--   - Join request INSERT tarafindaki trigger limiti kaldirildi
--
-- Not:
--   Bu migration, 20260325000016_company_plan_user_limits_join.sql ustune uygulanir.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.company_join_capacity_ok(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  lim  int;
  pk   text;
  appr int;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN false;
  END IF;

  pk := public.company_effective_plan_key(p_company_id);
  IF pk IS NULL THEN
    RETURN false;
  END IF;

  lim := public.plan_max_users(pk);

  SELECT COUNT(*)::int INTO appr
  FROM public.profiles p
  WHERE p.company_id = p_company_id
    AND p.role IS DISTINCT FROM 'superAdmin'
    AND p.role_approval_status = 'approved';

  RETURN appr < lim;
END;
$$;

COMMENT ON FUNCTION public.company_join_capacity_ok(uuid) IS
  'Kullanici kotasi icin sirketteki onayli kullanici sayisini kontrol eder (pending talepler dahil degil).';

DROP TRIGGER IF EXISTS trg_join_requests_plan_limit ON public.join_requests;

