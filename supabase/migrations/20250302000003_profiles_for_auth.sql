-- Extend profiles for Supabase Auth: full_name, role_approval_status.
-- App uses signUp/signIn and writes profile on register; RLS allows insert for own row.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name') THEN
    ALTER TABLE public.profiles ADD COLUMN full_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role_approval_status') THEN
    ALTER TABLE public.profiles ADD COLUMN role_approval_status text NOT NULL DEFAULT 'pending';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- Allow user to insert their own profile (id = auth.uid())
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Allow anon to select profile by id (for app to fetch after signIn when using anon key with session)
-- Actually after signIn the client has a session so it's authenticated. So we need authenticated select.
-- Optional: allow service or anon to read for backend. For now authenticated is enough.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Company Manager can update profiles in same company (e.g. approve role)
DROP POLICY IF EXISTS profiles_update_cm_same_company ON public.profiles;
CREATE POLICY profiles_update_cm_same_company ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
  )
  WITH CHECK (true);

COMMENT ON COLUMN public.profiles.full_name IS 'Display name. Set on register.';
COMMENT ON COLUMN public.profiles.role_approval_status IS 'pending | approved | rejected.';

-- Auto-create profile when a new auth user is created (signUp). Reads company_id, role, full_name from raw_user_meta_data.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, company_id, role, full_name, role_approval_status)
  VALUES (
    new.id,
    (new.raw_user_meta_data->>'company_id')::uuid,
    NULLIF(TRIM(new.raw_user_meta_data->>'role'), ''),
    NULLIF(TRIM(new.raw_user_meta_data->>'full_name'), ''),
    COALESCE(NULLIF(TRIM(new.raw_user_meta_data->>'role_approval_status'), ''), 'pending')
  );
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
