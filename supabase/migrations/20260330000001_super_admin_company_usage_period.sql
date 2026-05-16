-- =============================================================================
-- Super admin: şirket kullanım süresi (gün)
-- =============================================================================
-- usage_period_days + usage_period_started_at dolunca şirket salt okunur moda geçer
-- (veri görüntüleme açık; yeni işlem uygulama katmanında engellenir).
-- =============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS usage_period_days integer,
  ADD COLUMN IF NOT EXISTS usage_period_started_at timestamptz;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_usage_period_days_chk;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_usage_period_days_chk
  CHECK (
    usage_period_days IS NULL
    OR (usage_period_days >= 1 AND usage_period_days <= 3650)
  ) NOT VALID;

ALTER TABLE public.companies
  VALIDATE CONSTRAINT companies_usage_period_days_chk;

COMMENT ON COLUMN public.companies.usage_period_days IS
  'Super admin tanımlı kullanım süresi (gün); NULL ise süre sınırı yok.';
COMMENT ON COLUMN public.companies.usage_period_started_at IS
  'Kullanım süresinin başlangıcı; bitiş = started_at + usage_period_days.';

CREATE OR REPLACE FUNCTION public.company_usage_expires_at(p_company_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    CASE
      WHEN c.usage_period_days IS NULL OR c.usage_period_started_at IS NULL THEN NULL
      ELSE c.usage_period_started_at + (c.usage_period_days || ' days')::interval
    END
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;

CREATE OR REPLACE FUNCTION public.company_admin_usage_expired(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.company_usage_expires_at(p_company_id) IS NOT NULL
    AND now() >= public.company_usage_expires_at(p_company_id);
$$;

COMMENT ON FUNCTION public.company_usage_expires_at(uuid) IS
  'Şirket kullanım bitiş zamanı (super admin süresi).';
COMMENT ON FUNCTION public.company_admin_usage_expired(uuid) IS
  'Super admin kullanım süresi doldu mu.';

CREATE OR REPLACE FUNCTION public.super_admin_set_company_usage_period(
  p_company_id uuid,
  p_days integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_expires timestamptz;
BEGIN
  IF NOT public.get_is_super_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_id');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF p_days IS NOT NULL AND (p_days < 1 OR p_days > 3650) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_days');
  END IF;

  IF p_days IS NULL THEN
    UPDATE public.companies
    SET usage_period_days = NULL,
        usage_period_started_at = NULL
    WHERE id = p_company_id;
    RETURN jsonb_build_object('ok', true, 'usage_period_days', NULL, 'usage_expires_at', NULL);
  END IF;

  UPDATE public.companies
  SET usage_period_days = p_days,
      usage_period_started_at = now()
  WHERE id = p_company_id;

  v_expires := public.company_usage_expires_at(p_company_id);

  RETURN jsonb_build_object(
    'ok', true,
    'usage_period_days', p_days,
    'usage_period_started_at', (SELECT usage_period_started_at FROM public.companies WHERE id = p_company_id),
    'usage_expires_at', v_expires
  );
END;
$$;

COMMENT ON FUNCTION public.super_admin_set_company_usage_period(uuid, integer) IS
  'Super admin: şirket kullanım süresi (gün); NULL ile kaldırılır, kayıtta süre şimdi başlar.';

DROP FUNCTION IF EXISTS public.get_my_company_snapshot();

CREATE OR REPLACE FUNCTION public.get_my_company_snapshot()
RETURNS TABLE (
  id uuid,
  language_code text,
  name text,
  logo_url text,
  plan text,
  plan_start_date timestamptz,
  plan_end_date timestamptz,
  pending_plan text,
  pending_plan_billing_cycle text,
  payroll_start_day int,
  max_users_override integer,
  usage_period_days integer,
  usage_period_started_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    c.id,
    c.language_code,
    c.name,
    c.logo_url,
    c.plan,
    c.plan_start_date,
    c.plan_end_date,
    c.pending_plan,
    c.pending_plan_billing_cycle,
    c.payroll_start_day,
    c.max_users_override,
    c.usage_period_days,
    c.usage_period_started_at
  FROM public.profiles p
  INNER JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = auth.uid()
    AND p.company_id IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.company_usage_expires_at(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.company_usage_expires_at(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.company_usage_expires_at(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.company_usage_expires_at(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.company_admin_usage_expired(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.company_admin_usage_expired(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.company_admin_usage_expired(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.company_admin_usage_expired(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.super_admin_set_company_usage_period(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_set_company_usage_period(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.super_admin_set_company_usage_period(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_set_company_usage_period(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_company_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_company_snapshot() TO authenticated;
