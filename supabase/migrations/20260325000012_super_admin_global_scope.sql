-- =============================================================================
-- mk-score 00020 - Super admin global scope enforcement
-- =============================================================================
-- Purpose:
--   1) superAdmin users must be global (company_id IS NULL)
--   2) superAdmin users must not be blocked by pending approval
--   3) auth trigger should auto-normalize superAdmin metadata on signup
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Existing rows normalization
UPDATE public.profiles
SET company_id = NULL,
    role_approval_status = 'approved'
WHERE role = 'superAdmin';

-- Enforce invariant at DB level
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_super_admin_global_scope_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_super_admin_global_scope_chk
  CHECK (
    role IS DISTINCT FROM 'superAdmin'
    OR (company_id IS NULL AND role_approval_status = 'approved')
  ) NOT VALID;

ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_super_admin_global_scope_chk;

-- Signup trigger: normalize superAdmin meta at insert time
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_company_id uuid;
  meta_join_company_id uuid;
  meta_role text;
  normalized_company_id uuid;
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

  IF normalized_company_id IS NULL AND meta_join_company_id IS NOT NULL AND meta_role IS DISTINCT FROM 'superAdmin' THEN
    INSERT INTO public.join_requests (user_id, company_id, status)
    VALUES (new.id, meta_join_company_id, 'pending');
  END IF;

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RETURN new;
END;
$$;
