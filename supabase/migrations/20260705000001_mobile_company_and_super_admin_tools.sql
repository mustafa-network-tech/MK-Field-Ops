-- =============================================================================
-- Mobil şirket kaydı ve süper admin araçları
-- 1. subscription_status kolonu (yoksa ekle)
-- 2. request_join_company RPC (mobil mevcut şirkete katılım)
-- 3. super_admin_activate_company RPC
-- 4. super_admin_suspend_company RPC
-- =============================================================================

-- 1. subscription_status kolonu (yoksa ekle, mevcut aktif sayılır)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies'
      AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.companies
      ADD COLUMN subscription_status text DEFAULT 'active';
    UPDATE public.companies SET subscription_status = 'active'
    WHERE subscription_status IS NULL;
  END IF;
END $$;

-- 2. request_join_company — oturum açmış kullanıcı, şirket adı + kodu ile katılım talebi gönderir
CREATE OR REPLACE FUNCTION public.request_join_company(
  p_company_name text,
  p_join_code    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_company_id  uuid;
  v_user_id     uuid := auth.uid();
  v_existing    text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  -- Şirketi bul
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE lower(trim(name)) = lower(trim(p_company_name))
    AND trim(join_code)   = trim(p_join_code)
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company_not_found');
  END IF;

  -- Zaten üye mi?
  SELECT role_approval_status INTO v_existing
  FROM public.profiles
  WHERE id = v_user_id AND company_id = v_company_id;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_member');
  END IF;

  -- Kapasite kontrolü
  IF NOT public.company_join_capacity_ok(v_company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'capacity_full');
  END IF;

  -- join_request oluştur + profili güncelle (company_id bağla, pending)
  INSERT INTO public.join_requests (user_id, company_id, status)
  VALUES (v_user_id, v_company_id, 'pending')
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles
  SET company_id = v_company_id,
      role_approval_status = 'pending'
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.request_join_company(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_join_company(text, text) TO authenticated;

COMMENT ON FUNCTION public.request_join_company(text, text) IS
  'Mobil: oturum açık kullanıcı şirket adı+kodu ile katılım talebi gönderir.';

-- 3. super_admin_activate_company
CREATE OR REPLACE FUNCTION public.super_admin_activate_company(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'superAdmin' THEN RETURN false; END IF;

  UPDATE public.companies
  SET subscription_status = 'active',
      closure_requested_at = NULL,
      purge_after = NULL
  WHERE id = p_company_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_activate_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_activate_company(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.super_admin_activate_company(uuid) IS
  'SuperAdmin: şirketi aktif eder (subscription_status = active).';

-- 4. super_admin_suspend_company
CREATE OR REPLACE FUNCTION public.super_admin_suspend_company(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'superAdmin' THEN RETURN false; END IF;

  UPDATE public.companies
  SET subscription_status = 'suspended'
  WHERE id = p_company_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.super_admin_suspend_company(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_admin_suspend_company(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.super_admin_suspend_company(uuid) IS
  'SuperAdmin: şirketi askıya alır (subscription_status = suspended).';
