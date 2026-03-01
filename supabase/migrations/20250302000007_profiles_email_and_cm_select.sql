-- profiles: add email (for display in Users tab); CM/PM can SELECT profiles in same company (for pending approvals).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email') THEN
      ALTER TABLE public.profiles ADD COLUMN email text;
    END IF;
  END IF;
END $$;

-- Trigger: set email from auth.users on insert
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, company_id, role, full_name, role_approval_status, email)
  VALUES (
    new.id,
    (new.raw_user_meta_data->>'company_id')::uuid,
    NULLIF(TRIM(new.raw_user_meta_data->>'role'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
    COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'role_approval_status'), ''), 'pending'),
    new.email
  );
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RETURN new;
END;
$$;

-- CM/PM can SELECT profiles in same company (so they can see pending users and approve)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP POLICY IF EXISTS profiles_select_same_company_cm_pm ON public.profiles;
    CREATE POLICY profiles_select_same_company_cm_pm ON public.profiles
      FOR SELECT TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;
END $$;
