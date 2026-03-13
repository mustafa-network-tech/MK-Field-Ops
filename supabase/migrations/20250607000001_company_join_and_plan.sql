-- Company join code + plan: companies plan/join_code, join_requests table, RPC for verify, trigger for join flow.
-- Join code is 4 numeric digits. Plan is required for new companies. Join existing creates pending request only.

-- 1) Companies: add join_code, plan, billing_cycle, plan_status, trial_end_date, owner_user_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'join_code') THEN
    ALTER TABLE public.companies ADD COLUMN join_code char(4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'plan') THEN
    ALTER TABLE public.companies ADD COLUMN plan text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'billing_cycle') THEN
    ALTER TABLE public.companies ADD COLUMN billing_cycle text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'plan_status') THEN
    ALTER TABLE public.companies ADD COLUMN plan_status text DEFAULT 'trial';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'trial_end_date') THEN
    ALTER TABLE public.companies ADD COLUMN trial_end_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'owner_user_id') THEN
    ALTER TABLE public.companies ADD COLUMN owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.companies.join_code IS '4-digit code for joining existing company. Only shown in onboarding and to company manager in settings.';
COMMENT ON COLUMN public.companies.plan IS 'starter | professional | enterprise';
COMMENT ON COLUMN public.companies.billing_cycle IS 'monthly | yearly';
COMMENT ON COLUMN public.companies.plan_status IS 'trial | active | past_due etc.';
COMMENT ON COLUMN public.companies.owner_user_id IS 'Company manager who created the company.';

-- 2) Join requests: user requesting to join a company; CM approves or rejects
CREATE TABLE IF NOT EXISTS public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_user_company_pending
  ON public.join_requests (user_id, company_id)
  WHERE status = 'pending';

COMMENT ON TABLE public.join_requests IS 'Pending join requests; CM approves then user is attached to company.';

-- 3) RPC: verify company by name + join code (anon can call; returns company_id only if match)
CREATE OR REPLACE FUNCTION public.get_company_id_by_join(p_company_name text, p_join_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
BEGIN
  IF p_join_code IS NULL OR length(trim(p_join_code)) <> 4 OR trim(p_join_code) !~ '^\d{4}$' THEN
    RETURN NULL;
  END IF;
  SELECT id INTO cid
  FROM public.companies c
  WHERE lower(trim(c.name)) = lower(trim(p_company_name))
    AND trim(c.join_code) = trim(p_join_code)
  LIMIT 1;
  RETURN cid;
END;
$$;

-- 4) Trigger: on auth user create, if join_company_id in meta (and no company_id), insert join_request
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_company_id uuid;
  meta_join_company_id uuid;
BEGIN
  meta_company_id := (new.raw_user_meta_data->>'company_id')::uuid;
  meta_join_company_id := (new.raw_user_meta_data->>'join_company_id')::uuid;

  INSERT INTO public.profiles (id, company_id, role, full_name, role_approval_status, email)
  VALUES (
    new.id,
    meta_company_id,
    NULLIF(TRIM(new.raw_user_meta_data->>'role'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
    COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'role_approval_status'), ''), 'pending'),
    new.email
  );

  IF meta_company_id IS NULL AND meta_join_company_id IS NOT NULL THEN
    INSERT INTO public.join_requests (user_id, company_id, status)
    VALUES (new.id, meta_join_company_id, 'pending');
  END IF;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 5) RLS join_requests: CM/PM can SELECT and UPDATE (approve/reject) for their company
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS join_requests_select_cm_pm ON public.join_requests;
CREATE POLICY join_requests_select_cm_pm ON public.join_requests
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
  );

DROP POLICY IF EXISTS join_requests_update_cm ON public.join_requests;
CREATE POLICY join_requests_update_cm ON public.join_requests
  FOR UPDATE TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'companyManager'
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- User can SELECT their own join requests (for pending-join screen)
DROP POLICY IF EXISTS join_requests_select_own ON public.join_requests;
CREATE POLICY join_requests_select_own ON public.join_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- CM can SELECT profiles that are in their company's pending join_requests (so we can show name/email in approval UI)
DROP POLICY IF EXISTS profiles_select_pending_join_cm ON public.profiles;
CREATE POLICY profiles_select_pending_join_cm ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'companyManager'
    AND (SELECT company_id FROM public.profiles WHERE id = auth.uid()) IS NOT NULL
    AND id IN (
      SELECT user_id FROM public.join_requests
      WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND status = 'pending'
    )
  );

-- 6) RPC: approve join request (CM only) – attach user to company, set role, update request status
CREATE OR REPLACE FUNCTION public.approve_join_request(req_id uuid, assigned_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
  my_company_id uuid;
  my_role text;
BEGIN
  SELECT company_id, role INTO my_company_id, my_role
  FROM public.profiles WHERE id = auth.uid();
  IF my_role <> 'companyManager' OR my_company_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT jr.id, jr.user_id, jr.company_id INTO req
  FROM public.join_requests jr
  WHERE jr.id = approve_join_request.req_id AND jr.company_id = my_company_id AND jr.status = 'pending';
  IF req.id IS NULL THEN
    RETURN false;
  END IF;

  IF assigned_role IS NULL OR assigned_role NOT IN ('companyManager', 'projectManager', 'teamLeader') THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET company_id = req.company_id, role = assigned_role, role_approval_status = 'approved'
  WHERE id = req.user_id;

  UPDATE public.join_requests SET status = 'approved' WHERE id = req.id;
  RETURN true;
END;
$$;

-- 7) RPC: reject join request (CM only)
CREATE OR REPLACE FUNCTION public.reject_join_request(req_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_company_id uuid;
  my_role text;
BEGIN
  SELECT company_id, role INTO my_company_id, my_role
  FROM public.profiles WHERE id = auth.uid();
  IF my_role <> 'companyManager' OR my_company_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.join_requests
  SET status = 'rejected'
  WHERE id = reject_join_request.req_id AND company_id = my_company_id AND status = 'pending';
  RETURN FOUND;
END;
$$;
