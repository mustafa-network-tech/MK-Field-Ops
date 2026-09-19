-- REVIEW ONLY: do not apply to production without an approved release.
-- No existing profile/company rows are updated or deleted.
BEGIN;

-- Auth owns initial profile creation. Metadata is display/input data, never authority.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_company uuid;
BEGIN
  INSERT INTO public.profiles (id, company_id, role, full_name, role_approval_status, email)
  VALUES (NEW.id, NULL, NULL, NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'pending', NEW.email);

  -- Name/code are an untrusted join REQUEST, checked against DB; no membership is granted.
  -- Ignore legacy role/company_id/join_company_id/approval metadata entirely.
  IF NEW.raw_user_meta_data ? 'join_company_name' OR NEW.raw_user_meta_data ? 'join_code' THEN
    requested_company := public.get_company_id_by_join(
      NEW.raw_user_meta_data->>'join_company_name', NEW.raw_user_meta_data->>'join_code');
    IF requested_company IS NULL THEN
      RAISE EXCEPTION 'Invalid company join credentials' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.join_requests (user_id, company_id, status)
    VALUES (NEW.id, requested_company, 'pending');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

-- Block client-side recreation/upsert of a privileged profile and unpaid companies.
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
REVOKE INSERT, DELETE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT INSERT, DELETE ON public.profiles TO service_role;
DROP POLICY IF EXISTS companies_insert_anon ON public.companies;
REVOKE INSERT ON public.companies FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.companies TO service_role;
REVOKE INSERT ON public.join_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off
AS $$
  SELECT company_id FROM public.profiles
  WHERE id = auth.uid() AND role_approval_status = 'approved'
    AND role IN ('companyManager', 'projectManager', 'teamLeader') LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.get_my_profile_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND role_approval_status = 'approved'
    AND ((role = 'superAdmin' AND company_id IS NULL)
      OR (role IN ('companyManager', 'projectManager', 'teamLeader') AND company_id IS NOT NULL)) LIMIT 1;
$$;

-- Keep valid DB roles intact. Only trusted SQL/service_role may grant superAdmin.
-- JWT role is server-issued; unlike user_metadata, callers cannot edit it.
CREATE OR REPLACE FUNCTION public.profiles_prevent_self_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF (auth.role() IN ('anon', 'authenticated') OR current_user IN ('anon', 'authenticated')) THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Profile identity is immutable' USING ERRCODE = '42501';
    END IF;
    IF NEW.role = 'superAdmin' AND OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'superAdmin assignment requires trusted server/database access' USING ERRCODE = '42501';
    END IF;
    IF OLD.id = auth.uid() AND (
      NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.role IS DISTINCT FROM OLD.role OR
      NEW.role_approval_status IS DISTINCT FROM OLD.role_approval_status OR
      NEW.can_see_prices IS DISTINCT FROM OLD.can_see_prices) THEN
      RAISE EXCEPTION 'Self profile permission update is forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Detached users may request membership, but cannot move an existing privileged profile.
CREATE OR REPLACE FUNCTION public.request_join_company(p_company_name text, p_join_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off
AS $$
DECLARE
  requested_company uuid;
  caller_profile public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated'); END IF;
  SELECT * INTO caller_profile FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_profile'); END IF;
  IF caller_profile.company_id IS NOT NULL OR caller_profile.role IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_member');
  END IF;
  requested_company := public.get_company_id_by_join(p_company_name, p_join_code);
  IF requested_company IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'company_not_found'); END IF;
  IF NOT public.company_join_capacity_ok(requested_company) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'capacity_full');
  END IF;
  INSERT INTO public.join_requests (user_id, company_id, status)
  VALUES (auth.uid(), requested_company, 'pending') ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.request_join_company(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_join_company(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_join_request(req_id uuid, assigned_role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off
AS $$
DECLARE
  req record;
  my_company_id uuid;
  appr int;
  lim int;
BEGIN
  my_company_id := public.get_my_profile_company_id();
  IF public.get_my_profile_role() IS DISTINCT FROM 'companyManager' OR my_company_id IS NULL THEN RETURN false; END IF;
  IF assigned_role IS NULL OR assigned_role NOT IN ('companyManager', 'projectManager', 'teamLeader') THEN RETURN false; END IF;
  -- Serialize approval seat checks for this company; keep existing plan limits.
  PERFORM 1 FROM public.companies WHERE id = my_company_id FOR UPDATE;
  SELECT jr.id, jr.user_id, jr.company_id INTO req FROM public.join_requests jr
  WHERE jr.id = req_id AND jr.company_id = my_company_id AND jr.status = 'pending' FOR UPDATE;
  IF NOT FOUND OR req.user_id = auth.uid() THEN RETURN false; END IF;
  PERFORM 1 FROM public.profiles WHERE id = req.user_id
    AND (company_id IS NULL OR company_id = req.company_id) AND role IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  lim := public.company_max_users(req.company_id);
  IF lim IS NULL THEN RETURN false; END IF;
  SELECT count(*)::int INTO appr FROM public.profiles
  WHERE company_id = req.company_id AND role IS DISTINCT FROM 'superAdmin' AND role_approval_status = 'approved';
  IF appr + 1 > lim THEN RETURN false; END IF;
  UPDATE public.profiles SET company_id = req.company_id, role = assigned_role, role_approval_status = 'approved'
  WHERE id = req.user_id;
  UPDATE public.join_requests SET status = 'approved' WHERE id = req.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_join_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid, text) TO authenticated, service_role;

-- An old deployed mock endpoint must not claim a pending signup either.
CREATE OR REPLACE FUNCTION public.try_claim_pending_signup(p_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT false; $$;
REVOKE ALL ON FUNCTION public.try_claim_pending_signup(uuid) FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
