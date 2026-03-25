-- =============================================================================
-- mk-score 00017 - companies_insert_anon anti-bot guard
-- =============================================================================
-- Amaç:
--   Anon şirket oluşturma akışını (signup öncesi) DB tarafında asgari düzeyde
--   sıkılaştırmak: format doğrulama + zaman penceresi limit.
--
-- Not:
--   Gerçek IP/email bazlı rate-limit Edge/API katmanında yapılmalıdır.
--   Bu migration DB seviyesinde ek koruma sağlar.
-- =============================================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.allow_anon_company_insert(
  p_name text,
  p_join_code text,
  p_plan text,
  p_billing_cycle text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_name text := lower(trim(coalesce(p_name, '')));
  v_count_1m integer;
  v_count_10m integer;
BEGIN
  -- Basic input hygiene
  IF length(v_name) < 3 OR length(v_name) > 120 THEN
    RETURN false;
  END IF;
  IF p_join_code IS NULL OR trim(p_join_code) !~ '^\d{4}$' THEN
    RETURN false;
  END IF;
  IF p_plan IS NULL OR p_plan NOT IN ('starter', 'professional', 'enterprise') THEN
    RETURN false;
  END IF;
  IF p_billing_cycle IS NULL OR p_billing_cycle NOT IN ('monthly', 'yearly') THEN
    RETURN false;
  END IF;

  -- Duplicate normalized name (defense in depth; unique index also enforces)
  IF EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE lower(trim(c.name)) = v_name
  ) THEN
    RETURN false;
  END IF;

  -- Global velocity guard (DB-side coarse throttle)
  SELECT count(*) INTO v_count_1m
  FROM public.companies c
  WHERE c.created_at >= now() - interval '1 minute';

  SELECT count(*) INTO v_count_10m
  FROM public.companies c
  WHERE c.created_at >= now() - interval '10 minutes';

  -- Tuneable thresholds
  IF v_count_1m >= 8 THEN
    RETURN false;
  END IF;
  IF v_count_10m >= 40 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.allow_anon_company_insert(text, text, text, text) IS
  'DB-level coarse anti-bot guard for anon company insert: validates input and limits burst velocity.';

REVOKE ALL ON FUNCTION public.allow_anon_company_insert(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.allow_anon_company_insert(text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.allow_anon_company_insert(text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.allow_anon_company_insert(text, text, text, text) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS companies_insert_anon ON public.companies;
CREATE POLICY companies_insert_anon
ON public.companies
FOR INSERT
TO anon
WITH CHECK (
  public.allow_anon_company_insert(name, join_code::text, plan, billing_cycle)
);
