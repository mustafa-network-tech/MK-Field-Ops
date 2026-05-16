-- =============================================================================
-- Super admin: şirket silme + kopmuş kullanıcıların yeniden katılım talebi
-- =============================================================================
-- super_admin_delete_company:
--   - Yalnızca onaylı superAdmin çağırabilir.
--   - Şirket üyelerinin auth.users kaydı silinmez / engellenmez.
--   - profiles: company_id ve role kaldırılır; role_approval_status approved kalır (giriş açık).
--   - Şirket ve operasyonel veriler CASCADE ile silinir.
-- request_join_company:
--   - Şirketi olmayan onaylı kullanıcı yeni şirkete katılım talebi gönderebilir.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.super_admin_delete_company(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_detached integer := 0;
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

  -- Auth metadata: üyelik bilgisi temizlenir; hesap engellenmez.
  UPDATE auth.users u
  SET raw_user_meta_data = (
    COALESCE(u.raw_user_meta_data, '{}'::jsonb)
    - 'company_id'
    - 'company_name'
    - 'role'
  ) || jsonb_build_object('role_approval_status', 'approved')
  WHERE u.id IN (
    SELECT p.id
    FROM public.profiles p
    WHERE p.company_id = p_company_id
      AND p.role IS DISTINCT FROM 'superAdmin'
  );

  WITH detached AS (
    UPDATE public.profiles p
    SET
      company_id = NULL,
      role = NULL,
      role_approval_status = 'approved',
      can_see_prices = NULL
    WHERE p.company_id = p_company_id
      AND p.role IS DISTINCT FROM 'superAdmin'
    RETURNING p.id
  )
  SELECT count(*)::integer INTO v_detached FROM detached;

  UPDATE public.companies
  SET owner_user_id = NULL
  WHERE id = p_company_id;

  DELETE FROM public.companies
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'delete_failed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'detached_users', v_detached);
END;
$$;

COMMENT ON FUNCTION public.super_admin_delete_company(uuid) IS
  'Super admin: şirketi ve verilerini siler; üyelerin auth hesabı kalır, yalnızca şirket üyeliği kaldırılır.';

CREATE OR REPLACE FUNCTION public.request_join_company(p_company_name text, p_join_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_my_company_id uuid;
  v_my_role text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT p.company_id, p.role
  INTO v_my_company_id, v_my_role
  FROM public.profiles p
  WHERE p.id = v_uid;

  IF v_my_role = 'superAdmin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_my_company_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_member');
  END IF;

  v_company_id := public.get_company_id_by_join(p_company_name, p_join_code);
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'company_not_found');
  END IF;

  IF NOT public.company_join_capacity_ok(v_company_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'capacity_full');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.join_requests jr
    WHERE jr.user_id = v_uid
      AND jr.company_id = v_company_id
      AND jr.status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_pending', true);
  END IF;

  INSERT INTO public.join_requests (user_id, company_id, status)
  VALUES (v_uid, v_company_id, 'pending');

  UPDATE public.profiles
  SET role_approval_status = 'approved'
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', true, 'already_pending', true);
END;
$$;

COMMENT ON FUNCTION public.request_join_company(text, text) IS
  'Şirketi olmayan kullanıcı: ad + katılım kodu ile join_requests oluşturur; giriş engellenmez.';

REVOKE ALL ON FUNCTION public.super_admin_delete_company(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_admin_delete_company(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.super_admin_delete_company(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_delete_company(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.request_join_company(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_join_company(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.request_join_company(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.request_join_company(text, text) TO authenticated, service_role;
