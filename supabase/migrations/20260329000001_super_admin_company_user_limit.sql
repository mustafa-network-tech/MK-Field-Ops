-- =============================================================================
-- Super admin: şirket başına özel kullanıcı limiti (max_users_override)
-- =============================================================================
-- NULL → plan varsayılanı (starter 4, professional 7, enterprise 15)
-- Dolu → super admin tarafından belirlenen üst sınır (DB + onay/katılım kontrolleri)
-- =============================================================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS max_users_override integer;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_max_users_override_chk;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_max_users_override_chk
  CHECK (
    max_users_override IS NULL
    OR (max_users_override >= 1 AND max_users_override <= 999)
  ) NOT VALID;

ALTER TABLE public.companies
  VALIDATE CONSTRAINT companies_max_users_override_chk;

COMMENT ON COLUMN public.companies.max_users_override IS
  'Super admin özel kullanıcı kotası; NULL ise plan_max_users(plan) kullanılır.';

CREATE OR REPLACE FUNCTION public.company_max_users(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  r public.companies%ROWTYPE;
  pk text;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO r FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF r.max_users_override IS NOT NULL THEN
    RETURN r.max_users_override;
  END IF;

  pk := public.company_effective_plan_key(p_company_id);
  IF pk IS NULL THEN
    RETURN public.plan_max_users('starter');
  END IF;

  RETURN public.plan_max_users(pk);
END;
$$;

COMMENT ON FUNCTION public.company_max_users(uuid) IS
  'Şirket için geçerli kullanıcı limiti: max_users_override veya plan kotası.';

CREATE OR REPLACE FUNCTION public.company_join_capacity_ok(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  lim  int;
  appr int;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN false;
  END IF;

  lim := public.company_max_users(p_company_id);
  IF lim IS NULL THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)::int INTO appr
  FROM public.profiles p
  WHERE p.company_id = p_company_id
    AND p.role IS DISTINCT FROM 'superAdmin'
    AND p.role_approval_status = 'approved';

  RETURN appr < lim;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_join_request(req_id uuid, assigned_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  req           record;
  my_company_id uuid;
  my_role       text;
  appr          int;
  lim           int;
BEGIN
  SELECT company_id, role INTO my_company_id, my_role
  FROM public.profiles WHERE id = auth.uid();
  IF my_role <> 'companyManager' OR my_company_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT jr.id, jr.user_id, jr.company_id INTO req
  FROM public.join_requests jr
  WHERE jr.id = approve_join_request.req_id
    AND jr.company_id = my_company_id
    AND jr.status = 'pending';
  IF req.id IS NULL THEN
    RETURN false;
  END IF;

  IF assigned_role IS NULL OR assigned_role NOT IN ('companyManager', 'projectManager', 'teamLeader') THEN
    RETURN false;
  END IF;

  lim := public.company_max_users(req.company_id);
  IF lim IS NULL THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)::int INTO appr
  FROM public.profiles p
  WHERE p.company_id = req.company_id
    AND p.role IS DISTINCT FROM 'superAdmin'
    AND p.role_approval_status = 'approved';

  IF appr + 1 > lim THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET company_id = req.company_id,
      role = assigned_role,
      role_approval_status = 'approved'
  WHERE id = req.user_id;

  UPDATE public.join_requests SET status = 'approved' WHERE id = req.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_admin_set_company_user_limit(
  p_company_id uuid,
  p_max_users integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
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

  IF p_max_users IS NOT NULL AND (p_max_users < 1 OR p_max_users > 999) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_limit');
  END IF;

  UPDATE public.companies
  SET max_users_override = p_max_users
  WHERE id = p_company_id;

  RETURN jsonb_build_object(
    'ok', true,
    'max_users', public.company_max_users(p_company_id),
    'max_users_override', p_max_users
  );
END;
$$;

COMMENT ON FUNCTION public.super_admin_set_company_user_limit(uuid, integer) IS
  'Super admin: şirket kullanıcı limiti (NULL = plan varsayılanına dön).';

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
  max_users_override integer
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
    c.max_users_override
  FROM public.profiles p
  INNER JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = auth.uid()
    AND p.company_id IS NOT NULL
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.company_max_users(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.company_max_users(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.company_max_users(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.company_max_users(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.super_admin_set_company_user_limit(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_set_company_user_limit(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.super_admin_set_company_user_limit(uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_set_company_user_limit(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_company_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_company_snapshot() TO authenticated;
