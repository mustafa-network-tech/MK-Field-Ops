-- Teams: soft-wipe (archived) so same team code can be reused for a new active team
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS wiped_at timestamptz;

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS uq_teams_company_code;
DROP INDEX IF EXISTS uq_teams_company_code_active;
CREATE UNIQUE INDEX uq_teams_company_code_active
  ON public.teams (company_id, code)
  WHERE wiped_at IS NULL;

-- Allow removing user from company (profile.company_id = NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'company_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN company_id DROP NOT NULL;
  END IF;
END $$;

-- CM/PM may set another user's company_id to NULL (remove from company)
DROP POLICY IF EXISTS profiles_update_cm_same_company ON public.profiles;
CREATE POLICY profiles_update_cm_same_company ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
  )
  WITH CHECK (
    company_id IS NULL
    OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

COMMENT ON COLUMN public.teams.wiped_at IS 'When set, team is archived/wiped; excluded from active lists; same (company_id, code) allowed for a new row.';
