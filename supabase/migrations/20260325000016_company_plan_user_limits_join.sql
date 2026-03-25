-- =============================================================================
-- mk-score — Şirket planı kullanıcı limiti (kayıt + onay) ve auth tetikleyici
-- =============================================================================
-- Kurallar (src/services/planGating.ts ile aynı sayılar):
--   starter: 4, professional: 7, enterprise: 15
-- superAdmin profilleri sayıma dahil değildir (zaten company_id NULL olmalı).
-- Kontör: onaylı üyeler + bekleyen join_requests (pending) < limit iken yeni
-- davet kabul edilir. approve_join_request ek onaylı satırı plana göre sınırlar.
-- handle_new_auth_user: unique_violation dışındaki hatalar yutulmaz (limit vb.).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.plan_max_users(p_plan text)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(trim(coalesce(p_plan, '')))
    WHEN 'starter' THEN 4
    WHEN 'professional' THEN 7
    WHEN 'enterprise' THEN 15
    ELSE 4
  END;
$$;

COMMENT ON FUNCTION public.plan_max_users(text) IS
  'Plana göre max kullanıcı sayısı (MKfieldOPS planGating ile uyumlu).';

CREATE OR REPLACE FUNCTION public.company_effective_plan_key(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  r public.companies%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF r.pending_plan IS NOT NULL
     AND r.pending_plan IN ('starter', 'professional', 'enterprise')
     AND r.plan_end_date IS NOT NULL
     AND now() >= r.plan_end_date THEN
    RETURN r.pending_plan::text;
  END IF;
  IF r.plan IS NOT NULL AND r.plan IN ('starter', 'professional', 'enterprise') THEN
    RETURN r.plan::text;
  END IF;
  RETURN 'starter';
END;
$$;

-- (onaylı üye + bekleyen katılım talebi) < limit → bir yeni pending talep için yer var
CREATE OR REPLACE FUNCTION public.company_join_capacity_ok(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  lim       int;
  pk        text;
  appr      int;
  pend      int;
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
  SELECT COUNT(*)::int INTO pend
  FROM public.join_requests jr
  WHERE jr.company_id = p_company_id
    AND jr.status = 'pending';
  RETURN (appr + pend) < lim;
END;
$$;

COMMENT ON FUNCTION public.company_join_capacity_ok(uuid) IS
  'Yeni pending join talebi için yer var mı (onaylı + bekleyen < plan limiti).';

GRANT EXECUTE ON FUNCTION public.company_join_capacity_ok(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.company_join_capacity_ok(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_requests_enforce_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;
  IF NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT public.company_join_capacity_ok(NEW.company_id) THEN
    RAISE EXCEPTION 'company_user_limit'
      USING ERRCODE = '23514',
            MESSAGE = 'Company user limit reached for plan (including pending join requests).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_join_requests_plan_limit ON public.join_requests;
CREATE TRIGGER trg_join_requests_plan_limit
  BEFORE INSERT ON public.join_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.join_requests_enforce_plan_limit();

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
  pk            text;
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

  pk := public.company_effective_plan_key(req.company_id);
  lim := public.plan_max_users(pk);
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

-- Auth tetikleyici: superAdmin global; join kapasitesi join_requests trigger ile da
-- zaten kontrol edilir — burada sadece geniş EXCEPTION yutmayı daraltıyoruz.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_company_id       uuid;
  meta_join_company_id    uuid;
  meta_role               text;
  normalized_company_id   uuid;
  normalized_role_approval text;
BEGIN
  meta_role := NULLIF(TRIM(new.raw_user_meta_data->>'role'), '');
  meta_company_id := (new.raw_user_meta_data->>'company_id')::uuid;
  meta_join_company_id := (new.raw_user_meta_data->>'join_company_id')::uuid;

  normalized_company_id :=
    CASE WHEN meta_role = 'superAdmin' THEN NULL ELSE meta_company_id END;

  normalized_role_approval :=
    CASE
      WHEN meta_role = 'superAdmin' THEN 'approved'
      ELSE COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'role_approval_status'), ''), 'pending')
    END;

  INSERT INTO public.profiles (id, company_id, role, full_name, role_approval_status, email)
  VALUES (
    new.id,
    normalized_company_id,
    meta_role,
    NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
    normalized_role_approval,
    new.email
  );

  IF normalized_company_id IS NULL
     AND meta_join_company_id IS NOT NULL
     AND meta_role IS DISTINCT FROM 'superAdmin' THEN
    INSERT INTO public.join_requests (user_id, company_id, status)
    VALUES (new.id, meta_join_company_id, 'pending');
  END IF;

  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    RETURN new;
  WHEN OTHERS THEN
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.join_requests_enforce_plan_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_requests_enforce_plan_limit() FROM anon;
REVOKE ALL ON FUNCTION public.join_requests_enforce_plan_limit() FROM authenticated;

REVOKE ALL ON FUNCTION public.plan_max_users(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.plan_max_users(text) FROM anon;
REVOKE ALL ON FUNCTION public.plan_max_users(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.plan_max_users(text) TO service_role;

REVOKE ALL ON FUNCTION public.company_effective_plan_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.company_effective_plan_key(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.company_effective_plan_key(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.company_effective_plan_key(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.company_join_capacity_ok(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.company_join_capacity_ok(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.company_join_capacity_ok(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.company_join_capacity_ok(uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_join_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_join_request(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.approve_join_request(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM authenticated;
