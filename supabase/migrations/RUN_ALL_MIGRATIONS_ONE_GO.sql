-- ===== 20250101000001_payroll_period_schema.sql =====
-- Payroll period rollover: schema
-- Companies: ensure timezone and payroll_start_day columns exist.
-- Create payroll_periods table. Add payroll_period_id to jobs if table exists.

-- 1) Companies: add columns if using existing table (run ALTER only if columns missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Istanbul';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'payroll_start_day'
  ) THEN
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS payroll_start_day int DEFAULT 20
      CHECK (payroll_start_day >= 1 AND payroll_start_day <= 31);
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- companies table does not exist; create minimal one for migration to work
    CREATE TABLE companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      timezone text NOT NULL DEFAULT 'Europe/Istanbul',
      payroll_start_day int NOT NULL DEFAULT 20 CHECK (payroll_start_day >= 1 AND payroll_start_day <= 31),
      created_at timestamptz DEFAULT now()
    );
END $$;

-- 2) Payroll periods table (company_id must match companies.id type: uuid)
CREATE TABLE IF NOT EXISTS payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_periods_company_start_end UNIQUE (company_id, start_date, end_date),
  CONSTRAINT chk_payroll_periods_dates CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_company_locked
  ON payroll_periods (company_id, is_locked) WHERE is_locked = false;

CREATE INDEX IF NOT EXISTS idx_payroll_periods_company_dates
  ON payroll_periods (company_id, start_date, end_date);

-- 3) Jobs: add payroll_period_id if jobs table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'jobs' AND column_name = 'payroll_period_id'
    ) THEN
      ALTER TABLE jobs ADD COLUMN payroll_period_id uuid REFERENCES payroll_periods(id);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'jobs' AND column_name = 'job_date'
    ) THEN
      -- If your jobs table uses "date" instead of "job_date", add a comment for adapter
      -- ALTER TABLE jobs ADD COLUMN job_date date;
      NULL;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE payroll_periods IS 'One row per company per period. Only one active (is_locked=false) per company.';
COMMENT ON COLUMN payroll_periods.is_locked IS 'When true, no new jobs or updates allowed for job_date in this period.';

-- ===== 20250101000002_payroll_period_functions.sql =====
-- Compute payroll period for a company and reference date (local date in company timezone).
-- Returns the period that contains p_reference_date.
-- start_date: most recent date with day = payroll_start_day (clamped to last day of month).
-- end_date: day before next period's start_date.

CREATE OR REPLACE FUNCTION compute_payroll_period(
  p_payroll_start_day int,
  p_reference_date date
)
RETURNS TABLE (start_date date, end_date date)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_ref_month_start     date;
  v_ref_month_end      date;
  v_ref_day            int;
  v_start_date         date;
  v_next_month_start   date;
  v_next_month_end     date;
  v_next_start_offset  int;
  v_next_start         date;
  v_prev_month_start   date;
  v_prev_month_end     date;
BEGIN
  p_payroll_start_day := least(31, greatest(1, p_payroll_start_day));
  v_ref_month_start   := date_trunc('month', p_reference_date)::date;
  v_ref_month_end     := (v_ref_month_start + interval '1 month' - interval '1 day')::date;
  v_ref_day           := extract(day FROM p_reference_date)::int;

  IF v_ref_day >= p_payroll_start_day THEN
    v_start_date := v_ref_month_start + least(p_payroll_start_day - 1, v_ref_month_end - v_ref_month_start);
  ELSE
    v_prev_month_start := (v_ref_month_start - interval '1 month')::date;
    v_prev_month_end   := v_ref_month_start - 1;
    v_start_date       := v_prev_month_start + least(p_payroll_start_day - 1, v_prev_month_end - v_prev_month_start);
  END IF;

  v_next_month_start  := (date_trunc('month', v_start_date) + interval '1 month')::date;
  v_next_month_end    := (v_next_month_start + interval '1 month' - interval '1 day')::date;
  v_next_start_offset := least(p_payroll_start_day - 1, v_next_month_end - v_next_month_start);
  v_next_start        := v_next_month_start + v_next_start_offset;
  start_date          := v_start_date;
  end_date            := v_next_start - 1;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION compute_payroll_period(int, date) IS
  'Returns (start_date, end_date) of the payroll period containing p_reference_date for given payroll_start_day (1..31).';

-- Ensure exactly one active (unlocked) period for company containing p_today.
-- If active exists and p_today > active.end_date: lock it and create next period.
-- Idempotent: unique on (company_id, start_date, end_date) prevents duplicates.

CREATE OR REPLACE FUNCTION ensure_active_payroll_period(
  p_company_id uuid,
  p_today date
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_day   int;
  v_active      payroll_periods%rowtype;
  v_period      record;
  v_new_id      uuid;
BEGIN
  SELECT c.payroll_start_day INTO v_start_day
  FROM companies c WHERE c.id = p_company_id;
  IF v_start_day IS NULL THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND';
  END IF;

  SELECT * INTO v_active
  FROM payroll_periods
  WHERE company_id = p_company_id AND is_locked = false
  LIMIT 1;

  IF v_active.id IS NULL THEN
    SELECT * INTO v_period FROM compute_payroll_period(v_start_day, p_today) LIMIT 1;
    INSERT INTO payroll_periods (company_id, start_date, end_date, is_locked)
    VALUES (p_company_id, v_period.start_date, v_period.end_date, false)
    ON CONFLICT (company_id, start_date, end_date) DO UPDATE SET is_locked = false
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
  END IF;

  IF p_today > v_active.end_date THEN
    UPDATE payroll_periods SET is_locked = true WHERE id = v_active.id;
    SELECT * INTO v_period FROM compute_payroll_period(v_start_day, v_active.end_date + 1) LIMIT 1;
    INSERT INTO payroll_periods (company_id, start_date, end_date, is_locked)
    VALUES (p_company_id, v_period.start_date, v_period.end_date, false)
    ON CONFLICT (company_id, start_date, end_date) DO NOTHING
    RETURNING id INTO v_new_id;
    IF v_new_id IS NULL THEN
      SELECT id INTO v_new_id FROM payroll_periods
      WHERE company_id = p_company_id AND start_date = v_period.start_date AND end_date = v_period.end_date;
    END IF;
    RETURN v_new_id;
  END IF;

  RETURN v_active.id;
END;
$$;

COMMENT ON FUNCTION ensure_active_payroll_period(uuid, date) IS
  'Idempotent: ensures one active period for company containing p_today; locks ended period and creates next if needed.';

-- Backwards-compatibility overload: accept text company_id and cast to uuid
CREATE OR REPLACE FUNCTION ensure_active_payroll_period(
  p_company_id text,
  p_today date
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN ensure_active_payroll_period(p_company_id::uuid, p_today);
END;
$$;

-- ===== 20250101000003_payroll_period_jobs_trigger.sql =====
-- Compute payroll period for a company and reference date (local date in company timezone).
-- Returns the period that contains p_reference_date.
-- start_date: most recent date with day = payroll_start_day (clamped to last day of month).
-- end_date: day before next period's start_date.

CREATE OR REPLACE FUNCTION compute_payroll_period(
  p_payroll_start_day int,
  p_reference_date date
)
RETURNS TABLE (start_date date, end_date date)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_ref_month_start     date;
  v_ref_month_end      date;
  v_ref_day            int;
  v_start_date         date;
  v_next_month_start   date;
  v_next_month_end     date;
  v_next_start_offset  int;
  v_next_start         date;
  v_prev_month_start   date;
  v_prev_month_end     date;
BEGIN
  p_payroll_start_day := least(31, greatest(1, p_payroll_start_day));
  v_ref_month_start   := date_trunc('month', p_reference_date)::date;
  v_ref_month_end     := (v_ref_month_start + interval '1 month' - interval '1 day')::date;
  v_ref_day           := extract(day FROM p_reference_date)::int;

  IF v_ref_day >= p_payroll_start_day THEN
    v_start_date := v_ref_month_start + least(p_payroll_start_day - 1, v_ref_month_end - v_ref_month_start);
  ELSE
    v_prev_month_start := (v_ref_month_start - interval '1 month')::date;
    v_prev_month_end   := v_ref_month_start - 1;
    v_start_date       := v_prev_month_start + least(p_payroll_start_day - 1, v_prev_month_end - v_prev_month_start);
  END IF;

  v_next_month_start  := (date_trunc('month', v_start_date) + interval '1 month')::date;
  v_next_month_end    := (v_next_month_start + interval '1 month' - interval '1 day')::date;
  v_next_start_offset := least(p_payroll_start_day - 1, v_next_month_end - v_next_month_start);
  v_next_start        := v_next_month_start + v_next_start_offset;
  start_date          := v_start_date;
  end_date            := v_next_start - 1;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION compute_payroll_period(int, date) IS
  'Returns (start_date, end_date) of the payroll period containing p_reference_date for given payroll_start_day (1..31).';

-- Ensure exactly one active (unlocked) period for company containing p_today.
-- If active exists and p_today > active.end_date: lock it and create next period.
-- Idempotent: unique on (company_id, start_date, end_date) prevents duplicates.

CREATE OR REPLACE FUNCTION ensure_active_payroll_period(
  p_company_id uuid,
  p_today date
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_day   int;
  v_active      payroll_periods%rowtype;
  v_period      record;
  v_new_id      uuid;
BEGIN
  SELECT c.payroll_start_day INTO v_start_day
  FROM companies c WHERE c.id = p_company_id;
  IF v_start_day IS NULL THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND';
  END IF;

  SELECT * INTO v_active
  FROM payroll_periods
  WHERE company_id = p_company_id AND is_locked = false
  LIMIT 1;

  IF v_active.id IS NULL THEN
    SELECT * INTO v_period FROM compute_payroll_period(v_start_day, p_today) LIMIT 1;
    INSERT INTO payroll_periods (company_id, start_date, end_date, is_locked)
    VALUES (p_company_id, v_period.start_date, v_period.end_date, false)
    ON CONFLICT (company_id, start_date, end_date) DO UPDATE SET is_locked = false
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
  END IF;

  IF p_today > v_active.end_date THEN
    UPDATE payroll_periods SET is_locked = true WHERE id = v_active.id;
    SELECT * INTO v_period FROM compute_payroll_period(v_start_day, v_active.end_date + 1) LIMIT 1;
    INSERT INTO payroll_periods (company_id, start_date, end_date, is_locked)
    VALUES (p_company_id, v_period.start_date, v_period.end_date, false)
    ON CONFLICT (company_id, start_date, end_date) DO NOTHING
    RETURNING id INTO v_new_id;
    IF v_new_id IS NULL THEN
      SELECT id INTO v_new_id FROM payroll_periods
      WHERE company_id = p_company_id AND start_date = v_period.start_date AND end_date = v_period.end_date;
    END IF;
    RETURN v_new_id;
  END IF;

  RETURN v_active.id;
END;
$$;

COMMENT ON FUNCTION ensure_active_payroll_period(text, date) IS
  'Idempotent: ensures one active period for company containing p_today; locks ended period and creates next if needed.';

-- Backwards-compatibility overload: accept text company_id and cast to uuid
CREATE OR REPLACE FUNCTION ensure_active_payroll_period(
  p_company_id text,
  p_today date
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN ensure_active_payroll_period(p_company_id::uuid, p_today);
END;
$$;

-- ===== 20250301000001_company_profile_logo.sql =====
-- Company profile: editable name and logo
-- Add logo_url to companies; name remains editable via app.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN logo_url text;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- companies table does not exist; create minimal one
    CREATE TABLE public.companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      logo_url text,
      created_at timestamptz DEFAULT now()
    );
END $$;

COMMENT ON COLUMN public.companies.logo_url IS 'Public URL of company logo (e.g. Supabase Storage company-logos bucket).';

-- ===== 20250301000002_company_logos_storage_policies.sql =====
-- Storage RLS: allow uploads and public read for company-logos bucket
-- Fixes: "new row violates row-level security policy" when uploading logos
-- Idempotent: drop first so migration can be re-run

DROP POLICY IF EXISTS "company_logos_upload" ON storage.objects;
CREATE POLICY "company_logos_upload"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;
CREATE POLICY "company_logos_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_update" ON storage.objects;
CREATE POLICY "company_logos_update"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_delete" ON storage.objects;
CREATE POLICY "company_logos_delete"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'company-logos');

-- ===== 20250301000003_currency_and_decimal.sql =====
-- Currency and decimal(12,2) for money fields.
-- currency_code on company: optional override; when NULL, app uses locale (TR→TRY, EN→USD, ES/FR/DE→EUR).
-- All money columns should be decimal(12,2) for consistency and no floating-point drift.

-- 1) Companies: add currency_code for future manual override (e.g. 'USD', 'TRY', 'EUR')
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'companies' AND column_name = 'currency_code'
    ) THEN
      ALTER TABLE companies ADD COLUMN currency_code char(3) DEFAULT NULL;
      COMMENT ON COLUMN companies.currency_code IS 'Optional override. When NULL, app uses locale (TR→TRY, EN→USD, ES/FR/DE→EUR).';
    END IF;
  END IF;
END $$;

-- 2) work_items.unit_price: ensure numeric(12,2) if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_items') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_items' AND column_name = 'unit_price') THEN
      ALTER TABLE work_items ALTER COLUMN unit_price TYPE numeric(12,2) USING (round((unit_price)::numeric, 2));
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3) jobs: if quantity is stored as integer, consider altering to numeric(12,2) for decimal quantities
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
--     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'quantity') THEN
--       ALTER TABLE jobs ALTER COLUMN quantity TYPE numeric(12,2) USING quantity::numeric(12,2);
--     END IF;
--   END IF;
-- END $$;

-- ===== 20250302000001_audit_logs.sql =====
-- MVP Audit Log: immutable "who did what, when" for critical actions.
-- Requires Supabase Auth (auth.uid()). For SELECT by role we use public.profiles (id = auth.uid(), role, company_id);
-- App should upsert into profiles on login so RLS can allow CM/PM to see all, TL to see own.

-- 1) Profiles: one row per auth user (id = auth.uid()). Populate on login for RLS.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  company_id uuid
);

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- 2) Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  period_id uuid,
  team_code text,
  project_id text,
  user_agent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_period_id ON public.audit_logs(period_id);

-- 3) RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- INSERT: authenticated users can insert only their own logs (actor_user_id must equal auth.uid())
CREATE POLICY audit_logs_insert_own
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

-- SELECT: Company Manager & Project Manager see all; Team Leader sees only own (actor_user_id = auth.uid())
CREATE POLICY audit_logs_select_by_role
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        (p.role IN ('companyManager', 'projectManager'))
        OR (p.role = 'teamLeader' AND audit_logs.actor_user_id = auth.uid())
      )
    )
  );

-- No UPDATE or DELETE policies → logs are immutable

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail. INSERT only; no UPDATE/DELETE.';

-- ===== 20250302000002_company_language.sql =====
-- Company-wide language: stored at company level. Only CM/PM can change it.
-- Team Leader: read-only. Company Manager & Project Manager: read + update language_code.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'language_code'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN language_code text NOT NULL DEFAULT 'en';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- companies table created in earlier migration
END $$;

-- Constrain to supported locales
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS chk_companies_language_code;
ALTER TABLE public.companies
  ADD CONSTRAINT chk_companies_language_code
  CHECK (language_code IN ('en', 'tr', 'es', 'fr', 'de'));

COMMENT ON COLUMN public.companies.language_code IS 'Company UI language. Only Company Manager and Project Manager can update.';

-- RLS for companies (if not already enabled)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies so we can recreate conditionally
DROP POLICY IF EXISTS companies_select_own ON public.companies;
DROP POLICY IF EXISTS companies_select_anon_by_id ON public.companies;
DROP POLICY IF EXISTS companies_update_cm_pm ON public.companies;
DROP POLICY IF EXISTS companies_select_anon ON public.companies;
DROP POLICY IF EXISTS companies_update_anon ON public.companies;
-- When public.profiles exists: use role-based policies (authenticated = own company, CM/PM can update)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    CREATE POLICY companies_select_own ON public.companies FOR SELECT TO authenticated
      USING (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
    CREATE POLICY companies_update_cm_pm ON public.companies FOR UPDATE TO authenticated
      USING (
        id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Anon: allow read (fetch company language on app init) and update (persist language when app does not use Supabase Auth)
-- Frontend restricts language change to CM/PM only.
CREATE POLICY companies_select_anon ON public.companies FOR SELECT TO anon USING (true);
CREATE POLICY companies_update_anon ON public.companies FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ===== 20250302000003_profiles_for_auth.sql =====
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

-- ===== 20250302000004_rls_strict_multi_tenant.sql =====
-- RLS: Strict multi-tenant isolation. No USING (true). No cross-company access.
-- auth.users = identity; public.profiles = profile (id -> auth.users.id, company_id, role).
-- Admin override only via service_role key.

-- =============================================================================
-- 1. PUBLIC.COMPANIES – Remove always-true (anon) policies
-- =============================================================================
DROP POLICY IF EXISTS companies_select_anon ON public.companies;
DROP POLICY IF EXISTS companies_update_anon ON public.companies;

-- Authenticated policies (created in 20250302000002) remain:
-- companies_select_own: SELECT where id = (SELECT company_id FROM profiles WHERE id = auth.uid())
-- companies_update_cm_pm: UPDATE only for CM/PM and only their company

-- =============================================================================
-- 2. PUBLIC.PROFILES – Only if table exists. Strict CM policy (no WITH CHECK true).
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS profiles_update_cm_same_company ON public.profiles;
    CREATE POLICY profiles_update_cm_same_company ON public.profiles
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- 3. PUBLIC.USERS – If table exists, enable RLS and strict own-row-only policies
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS users_select_own ON public.users;
    CREATE POLICY users_select_own ON public.users
      FOR SELECT TO authenticated
      USING (id = auth.uid()::text);

    DROP POLICY IF EXISTS users_update_own ON public.users;
    CREATE POLICY users_update_own ON public.users
      FOR UPDATE TO authenticated
      USING (id = auth.uid()::text)
      WITH CHECK (id = auth.uid()::text);

    DROP POLICY IF EXISTS users_insert_own ON public.users;
    CREATE POLICY users_insert_own ON public.users
      FOR INSERT TO authenticated
      WITH CHECK (id = auth.uid()::text);

    -- Remove any always-true policies if they exist
    DROP POLICY IF EXISTS users_select_anon ON public.users;
    DROP POLICY IF EXISTS users_update_anon ON public.users;
    DROP POLICY IF EXISTS users_insert_anon ON public.users;
  END IF;
END $$;

-- =============================================================================
-- Summary
-- =============================================================================
-- companies:  SELECT/UPDATE only for authenticated; row must be user's company.
-- profiles:   SELECT/UPDATE own (id = auth.uid()); CM/PM can UPDATE same-company with strict CHECK.
-- users:      If present, SELECT/UPDATE/INSERT only own row (id = auth.uid()).
-- No anon policies with USING (true). Service role bypasses RLS for admin override.
--
-- Note: After this migration, unauthenticated clients cannot read companies. If your
-- "register existing company" flow needs to look up company by id/name before signUp,
-- use an Edge Function or backend with service_role to perform that lookup.

-- ===== 20250302000005_companies_insert_and_unique_name.sql =====
-- Allow company creation at signup (anon INSERT). Uniqueness by company name (case-insensitive).
-- INSERT: anon can insert (new company signup flow runs before auth).
-- SELECT/UPDATE: still restricted by existing RLS (authenticated own-company only after 20250302000004).

-- Unique constraint: one company per normalized name (lower, trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_unique
  ON public.companies (lower(trim(name)));

-- Allow anon to insert (used when user creates new company before signUp)
DROP POLICY IF EXISTS companies_insert_anon ON public.companies;
CREATE POLICY companies_insert_anon ON public.companies
  FOR INSERT TO anon
  WITH CHECK (true);

-- ===== 20250302000006_companies_rls_ensure.sql =====
-- Ensure public.companies has minimal RLS policies so INSERT does not fail silently.
-- Run this if you have "RLS enabled but no policies" (all operations denied).
-- Company creation at signup runs as anon (before signUp), so anon needs INSERT.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 1) INSERT: anon can insert (signup flow creates company before auth)
DROP POLICY IF EXISTS companies_insert_anon ON public.companies;
CREATE POLICY companies_insert_anon ON public.companies
  FOR INSERT TO anon
  WITH CHECK (true);

-- 2) SELECT: authenticated user can only see their own company (requires profiles)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP POLICY IF EXISTS companies_select_own ON public.companies;
    CREATE POLICY companies_select_own ON public.companies
      FOR SELECT TO authenticated
      USING (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- 3) UPDATE: authenticated CM/PM can update only their company
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP POLICY IF EXISTS companies_update_cm_pm ON public.companies;
    CREATE POLICY companies_update_cm_pm ON public.companies
      FOR UPDATE TO authenticated
      USING (
        id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ===== 20250302000007_profiles_email_and_cm_select.sql =====
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

-- ===== 20250401000001_campaigns_vehicles_equipment_work_items_materials.sql =====
-- =============================================================================
-- Migration: Campaigns, Vehicles, Equipment, Work Items, Materials
-- Bağımlılık: public.companies (20250101 veya 20250301 ile oluşturulmuş olmalı)
-- Bu tablolar şirket bazlı ana veri; RLS sonraki migration'da.
-- =============================================================================

-- Önce public.companies var mı kontrol et; yoksa net hata ver
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    RAISE EXCEPTION '20250401000001: public.companies yok. Önce 20250101000001, 20250301000001, 20250302000001 migration''larını çalıştırın.';
  END IF;
END $$;

-- 1) Campaigns – şirket kampanyaları (proje grupları)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_company_id ON public.campaigns (company_id);
COMMENT ON TABLE public.campaigns IS 'Company campaigns; projects are linked to a campaign.';

-- 2) Vehicles – şirket araçları (ekiplere atanabilir)
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plate_number text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  description text
);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON public.vehicles (company_id);
COMMENT ON TABLE public.vehicles IS 'Company vehicles; can be assigned to teams.';

-- 3) Equipment – ekipman (iş kaydında equipmentIds ile referans)
CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_equipment_company_id ON public.equipment (company_id);
COMMENT ON TABLE public.equipment IS 'Company equipment; referenced in job records.';

-- 4) Work Items – iş kalemleri (birim fiyat, birim türü)
CREATE TABLE IF NOT EXISTS public.work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  unit_type text NOT NULL,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_work_items_company_id ON public.work_items (company_id);
COMMENT ON TABLE public.work_items IS 'Work item definitions; unit price and type for job valuation.';

-- 5) Materials – basit malzeme kaydı (fiyat; bazı ekranlarda kullanılır)
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_materials_company_id ON public.materials (company_id);
COMMENT ON TABLE public.materials IS 'Legacy material records (code, price); material_stock is the main stock table.';

-- ===== 20250401000002_teams_and_projects.sql =====
-- =============================================================================
-- Migration: Teams, Projects
-- Bağımlılık: companies, profiles, vehicles, campaigns
-- Teams: leader_id -> profiles(id), vehicle_id -> vehicles(id)
-- Projects: campaign_id -> campaigns(id), created_by -> profiles(id), completed_by -> profiles(id)
-- =============================================================================

-- 1) Teams – ekipler (lider, araç, onay durumu, manuel üyeler json)
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  leader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_ids uuid[] DEFAULT '{}',
  members_manual jsonb DEFAULT '[]',
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teams_company_code UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_teams_company_id ON public.teams (company_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON public.teams (leader_id);
CREATE INDEX IF NOT EXISTS idx_teams_company_leader ON public.teams (company_id, leader_id);
COMMENT ON TABLE public.teams IS 'Teams; Team Leader sees only rows where leader_id = auth.uid().';

-- 2) Projects – projeler (kampanya, yıl, dış ID, durum, tamamlayan)
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  project_year int NOT NULL CHECK (project_year >= 2000 AND project_year <= 2100),
  external_project_id text NOT NULL,
  received_date date NOT NULL,
  name text,
  description text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects (company_id);
CREATE INDEX IF NOT EXISTS idx_projects_campaign_id ON public.projects (campaign_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_status ON public.projects (company_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_company_year_ext ON public.projects (company_id, project_year, external_project_id);
COMMENT ON TABLE public.projects IS 'Projects; key = (company, year, external_project_id).';

-- ===== 20250401000003_material_stock_allocations_audit.sql =====
-- =============================================================================
-- Migration: Material Stock, Team Material Allocations, Material Audit Log
-- Bağımlılık: companies, teams (allocations için)
-- material_stock: stok kalemleri (direk, kablo, boru, özel vb.)
-- team_material_allocations: ekip zimmeti (merkez -> ekip dağıtım)
-- material_audit_log: malzeme hareket denetim kayıtları
-- =============================================================================

-- 1) Material stock items – stok kalemleri (kablo metre/adet, spool, harici vb.)
CREATE TABLE IF NOT EXISTS public.material_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  main_type text NOT NULL,
  custom_group_name text,
  name text NOT NULL,
  size_or_capacity text,
  stock_qty numeric(12,2) CHECK (stock_qty IS NULL OR stock_qty >= 0),
  is_cable boolean DEFAULT false,
  cable_category text CHECK (cable_category IS NULL OR cable_category IN ('ic', 'yeraltı', 'havai')),
  capacity_label text,
  spool_id text,
  length_total numeric(12,2) CHECK (length_total IS NULL OR length_total >= 0),
  length_remaining numeric(12,2) CHECK (length_remaining IS NULL OR length_remaining >= 0),
  is_external boolean DEFAULT false,
  external_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_material_stock_company_id ON public.material_stock (company_id);
CREATE INDEX IF NOT EXISTS idx_material_stock_spool_id ON public.material_stock (company_id, spool_id) WHERE spool_id IS NOT NULL;
COMMENT ON TABLE public.material_stock IS 'Stock items: poles, cables (m/spool), pipes, etc.; team allocations reference this.';

-- 2) Team material allocations – ekip zimmeti (dağıtılan miktar)
CREATE TABLE IF NOT EXISTS public.team_material_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  material_stock_item_id uuid NOT NULL REFERENCES public.material_stock(id) ON DELETE RESTRICT,
  quantity_meters numeric(12,2) CHECK (quantity_meters IS NULL OR quantity_meters >= 0),
  quantity_pcs numeric(12,2) CHECK (quantity_pcs IS NULL OR quantity_pcs >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_allocation_quantity CHECK (
    (quantity_meters IS NOT NULL AND quantity_meters > 0) OR (quantity_pcs IS NOT NULL AND quantity_pcs > 0)
  )
);
CREATE INDEX IF NOT EXISTS idx_team_material_allocations_company_id ON public.team_material_allocations (company_id);
CREATE INDEX IF NOT EXISTS idx_team_material_allocations_team_id ON public.team_material_allocations (team_id);
CREATE INDEX IF NOT EXISTS idx_team_material_allocations_material ON public.team_material_allocations (material_stock_item_id);
COMMENT ON TABLE public.team_material_allocations IS 'Material allocated to teams (from central stock); job material usage can reference by team_zimmet_id.';

-- 3) Material audit log – malzeme hareket denetimi
CREATE TABLE IF NOT EXISTS public.material_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN (
    'STOCK_ADD', 'STOCK_EDIT', 'STOCK_DELETE', 'DISTRIBUTE_TO_TEAM',
    'RETURN_TO_STOCK', 'TRANSFER_BETWEEN_TEAMS', 'STOCK_ADJUSTMENT'
  )),
  actor_user_id uuid NOT NULL,
  actor_role text,
  material_stock_item_id uuid NOT NULL REFERENCES public.material_stock(id) ON DELETE CASCADE,
  from_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  to_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  qty_count numeric(12,2),
  qty_meters numeric(12,2),
  spool_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_material_audit_log_company_id ON public.material_audit_log (company_id);
CREATE INDEX IF NOT EXISTS idx_material_audit_log_created_at ON public.material_audit_log (company_id, created_at DESC);
COMMENT ON TABLE public.material_audit_log IS 'Audit trail for material movements (stock, distribute, return, transfer).';

-- ===== 20250401000004_delivery_notes.sql =====
-- =============================================================================
-- Migration: Delivery Notes, Delivery Note Items
-- Bağımlılık: companies, material_stock
-- İrsaliye: teslim alındığında oluşturulur; kalemler stok kalemi + miktar.
-- =============================================================================

-- 1) Delivery notes – irsaliye başlığı
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier text NOT NULL,
  received_date date NOT NULL,
  irsaliye_no text NOT NULL,
  received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_company_id ON public.delivery_notes (company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_received_date ON public.delivery_notes (company_id, received_date DESC);
COMMENT ON TABLE public.delivery_notes IS 'Delivery notes (irsaliye); immutable after receive.';

-- 2) Delivery note items – irsaliye kalemleri (stok kalemi + miktar + birim)
CREATE TABLE IF NOT EXISTS public.delivery_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  material_stock_item_id uuid NOT NULL REFERENCES public.material_stock(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  quantity_unit text NOT NULL CHECK (quantity_unit IN ('m', 'pcs')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON public.delivery_note_items (delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_material ON public.delivery_note_items (material_stock_item_id);
COMMENT ON TABLE public.delivery_note_items IS 'Line items of a delivery note; link to material_stock and quantity.';

-- ===== 20250401000005_jobs_and_payroll_period_settings.sql =====
-- =============================================================================
-- Migration: Jobs, Payroll Period Settings
-- Bağımlılık: companies, projects, teams, work_items, payroll_periods, profiles
-- jobs: iş kayıtları; payroll trigger (20250101000003) job_date/date ile payroll_period_id atar.
-- payroll_period_settings: şirket bazlı hakediş dönemi ayarı (start_day_of_month).
-- =============================================================================

-- 1) Jobs – iş kayıtları (tarih, proje, ekip, iş kalemi, miktar, malzeme/ekipman, onay)
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_date date NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  material_ids uuid[] DEFAULT '{}',
  material_usages jsonb DEFAULT '[]',
  equipment_ids uuid[] DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  stock_deducted boolean DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payroll_period_id uuid REFERENCES public.payroll_periods(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs (company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company_date ON public.jobs (company_id, job_date);
CREATE INDEX IF NOT EXISTS idx_jobs_company_status ON public.jobs (company_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_team_id ON public.jobs (team_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON public.jobs (project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_payroll_period_id ON public.jobs (payroll_period_id);
COMMENT ON TABLE public.jobs IS 'Job records; payroll trigger sets payroll_period_id from date. TL sees only own teams.';

-- Payroll trigger expects job_date or date; we use "date". Trigger in 20250101000003 references NEW.date.
-- After this migration, re-create trigger if needed (trigger creation is conditional on jobs existing).

-- 2) Payroll period settings – şirket başına dönem başlangıç günü (ayın kaçı)
CREATE TABLE IF NOT EXISTS public.payroll_period_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  start_day_of_month int NOT NULL CHECK (start_day_of_month >= 1 AND start_day_of_month <= 31),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.payroll_period_settings IS 'Per-company payroll period start day (e.g. 20 = period 20th to 19th next month).';

-- Ensure payroll trigger is attached to jobs (idempotent; 20250101000003 created the function)
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'payroll_period_id')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'jobs_resolve_payroll_period')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'jobs' AND t.tgname = 'trg_jobs_resolve_payroll_period') THEN
    CREATE TRIGGER trg_jobs_resolve_payroll_period
      BEFORE INSERT OR UPDATE OF company_id, job_date
      ON public.jobs
      FOR EACH ROW
      EXECUTE PROCEDURE jobs_resolve_payroll_period();
  END IF;
END $mig$;

-- ===== 20250401000006_rls_all_new_tables.sql =====
-- =============================================================================
-- RLS: Tüm yeni tablolar için çok kiracılı erişim kontrolü
-- Tablo yoksa atlanır (IF EXISTS); böylece 000001-000005 tam çalışmamış olsa da hata vermez.
-- =============================================================================

DO $rls$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
    ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS campaigns_company ON public.campaigns;
    CREATE POLICY campaigns_company ON public.campaigns FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
    ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS vehicles_company ON public.vehicles;
    CREATE POLICY vehicles_company ON public.vehicles FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipment') THEN
    ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS equipment_company ON public.equipment;
    CREATE POLICY equipment_company ON public.equipment FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_items') THEN
    ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS work_items_company ON public.work_items;
    CREATE POLICY work_items_company ON public.work_items FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materials') THEN
    ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS materials_company ON public.materials;
    CREATE POLICY materials_company ON public.materials FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teams') THEN
    ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS teams_company_or_leader ON public.teams;
    CREATE POLICY teams_company_or_leader ON public.teams FOR ALL TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager') OR leader_id = auth.uid())
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager') OR leader_id = auth.uid())
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS projects_company ON public.projects;
    CREATE POLICY projects_company ON public.projects FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_stock') THEN
    ALTER TABLE public.material_stock ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS material_stock_company ON public.material_stock;
    CREATE POLICY material_stock_company ON public.material_stock FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_material_allocations') THEN
    ALTER TABLE public.team_material_allocations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS team_material_allocations_company_or_leader ON public.team_material_allocations;
    CREATE POLICY team_material_allocations_company_or_leader ON public.team_material_allocations FOR ALL TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_audit_log') THEN
    ALTER TABLE public.material_audit_log ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS material_audit_log_company ON public.material_audit_log;
    CREATE POLICY material_audit_log_company ON public.material_audit_log FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_notes') THEN
    ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS delivery_notes_company ON public.delivery_notes;
    CREATE POLICY delivery_notes_company ON public.delivery_notes FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_note_items') THEN
    ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS delivery_note_items_via_note ON public.delivery_note_items;
    CREATE POLICY delivery_note_items_via_note ON public.delivery_note_items FOR ALL TO authenticated
      USING (delivery_note_id IN (SELECT id FROM public.delivery_notes WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())))
      WITH CHECK (delivery_note_id IN (SELECT id FROM public.delivery_notes WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS jobs_company_or_leader ON public.jobs;
    CREATE POLICY jobs_company_or_leader ON public.jobs FOR ALL TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_period_settings') THEN
    ALTER TABLE public.payroll_period_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS payroll_period_settings_company ON public.payroll_period_settings;
    CREATE POLICY payroll_period_settings_company ON public.payroll_period_settings FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_periods') THEN
    ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS payroll_periods_company ON public.payroll_periods;
    CREATE POLICY payroll_periods_company ON public.payroll_periods FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $rls$;

-- ===== 20250401000007_jobs_resolve_payroll_period_function.sql =====
-- =============================================================================
-- Migration: jobs_resolve_payroll_period trigger function (missing from 20250101/20250401)
-- Call after 20250401000005 (jobs table) and 20250101000002 (ensure_active_payroll_period).
-- Ensures job rows get payroll_period_id set on INSERT/UPDATE from job_date.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.jobs_resolve_payroll_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.payroll_period_id := ensure_active_payroll_period(NEW.company_id, NEW.job_date);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.jobs_resolve_payroll_period() IS
  'Trigger: set payroll_period_id on jobs from job_date using company payroll_start_day.';

-- Attach trigger to jobs if not already present
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'payroll_period_id')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'jobs' AND t.tgname = 'trg_jobs_resolve_payroll_period') THEN
    CREATE TRIGGER trg_jobs_resolve_payroll_period
      BEFORE INSERT OR UPDATE OF company_id, job_date
      ON public.jobs
      FOR EACH ROW
      EXECUTE FUNCTION public.jobs_resolve_payroll_period();
  END IF;
END $mig$;

-- ===== 20250501000001_profiles_basic_policies.sql =====
-- Basic RLS policies for public.profiles (idempotent).
-- Only: profiles_insert_own, profiles_select_own, profiles_update_own.
-- No same_company / cm / pm / admin / manager policies.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ===== 20250101000001_payroll_period_schema.sql =====

-- Payroll period rollover: schema
-- Companies: ensure timezone and payroll_start_day columns exist.
-- Create payroll_periods table. Add payroll_period_id to jobs if table exists.

-- 1) Companies: add columns if using existing table (run ALTER only if columns missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Europe/Istanbul';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'payroll_start_day'
  ) THEN
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS payroll_start_day int DEFAULT 20
      CHECK (payroll_start_day >= 1 AND payroll_start_day <= 31);
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- companies table does not exist; create minimal one for migration to work
    CREATE TABLE companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      timezone text NOT NULL DEFAULT 'Europe/Istanbul',
      payroll_start_day int NOT NULL DEFAULT 20 CHECK (payroll_start_day >= 1 AND payroll_start_day <= 31),
      created_at timestamptz DEFAULT now()
    );
END $$;

-- 2) Payroll periods table (company_id must match companies.id type: uuid)
CREATE TABLE IF NOT EXISTS payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_periods_company_start_end UNIQUE (company_id, start_date, end_date),
  CONSTRAINT chk_payroll_periods_dates CHECK (start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_company_locked
  ON payroll_periods (company_id, is_locked) WHERE is_locked = false;

CREATE INDEX IF NOT EXISTS idx_payroll_periods_company_dates
  ON payroll_periods (company_id, start_date, end_date);

-- 3) Jobs: add payroll_period_id if jobs table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'jobs' AND column_name = 'payroll_period_id'
    ) THEN
      ALTER TABLE jobs ADD COLUMN payroll_period_id uuid REFERENCES payroll_periods(id);
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'jobs' AND column_name = 'job_date'
    ) THEN
      -- If your jobs table uses "date" instead of "job_date", add a comment for adapter
      -- ALTER TABLE jobs ADD COLUMN job_date date;
      NULL;
    END IF;
  END IF;
END $$;

COMMENT ON TABLE payroll_periods IS 'One row per company per period. Only one active (is_locked=false) per company.';
COMMENT ON COLUMN payroll_periods.is_locked IS 'When true, no new jobs or updates allowed for job_date in this period.';

-- ===== 20250101000002_payroll_period_functions.sql =====

-- Compute payroll period for a company and reference date (local date in company timezone).
-- Returns the period that contains p_reference_date.
-- start_date: most recent date with day = payroll_start_day (clamped to last day of month).
-- end_date: day before next period's start_date.

CREATE OR REPLACE FUNCTION compute_payroll_period(
  p_payroll_start_day int,
  p_reference_date date
)
RETURNS TABLE (start_date date, end_date date)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_ref_month_start     date;
  v_ref_month_end      date;
  v_ref_day            int;
  v_start_date         date;
  v_next_month_start   date;
  v_next_month_end     date;
  v_next_start_offset  int;
  v_next_start         date;
  v_prev_month_start   date;
  v_prev_month_end     date;
BEGIN
  p_payroll_start_day := least(31, greatest(1, p_payroll_start_day));
  v_ref_month_start   := date_trunc('month', p_reference_date)::date;
  v_ref_month_end     := (v_ref_month_start + interval '1 month' - interval '1 day')::date;
  v_ref_day           := extract(day FROM p_reference_date)::int;

  IF v_ref_day >= p_payroll_start_day THEN
    v_start_date := v_ref_month_start + least(p_payroll_start_day - 1, v_ref_month_end - v_ref_month_start);
  ELSE
    v_prev_month_start := (v_ref_month_start - interval '1 month')::date;
    v_prev_month_end   := v_ref_month_start - 1;
    v_start_date       := v_prev_month_start + least(p_payroll_start_day - 1, v_prev_month_end - v_prev_month_start);
  END IF;

  v_next_month_start  := (date_trunc('month', v_start_date) + interval '1 month')::date;
  v_next_month_end    := (v_next_month_start + interval '1 month' - interval '1 day')::date;
  v_next_start_offset := least(p_payroll_start_day - 1, v_next_month_end - v_next_month_start);
  v_next_start        := v_next_month_start + v_next_start_offset;
  start_date          := v_start_date;
  end_date            := v_next_start - 1;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION compute_payroll_period(int, date) IS
  'Returns (start_date, end_date) of the payroll period containing p_reference_date for given payroll_start_day (1..31).';

-- Ensure exactly one active (unlocked) period for company containing p_today.
-- If active exists and p_today > active.end_date: lock it and create next period.
-- Idempotent: unique on (company_id, start_date, end_date) prevents duplicates.

CREATE OR REPLACE FUNCTION ensure_active_payroll_period(
  p_company_id uuid,
  p_today date
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_day   int;
  v_active      payroll_periods%rowtype;
  v_period      record;
  v_new_id      uuid;
BEGIN
  SELECT c.payroll_start_day INTO v_start_day
  FROM companies c WHERE c.id = p_company_id;
  IF v_start_day IS NULL THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND';
  END IF;

  SELECT * INTO v_active
  FROM payroll_periods
  WHERE company_id = p_company_id AND is_locked = false
  LIMIT 1;

  IF v_active.id IS NULL THEN
    SELECT * INTO v_period FROM compute_payroll_period(v_start_day, p_today) LIMIT 1;
    INSERT INTO payroll_periods (company_id, start_date, end_date, is_locked)
    VALUES (p_company_id, v_period.start_date, v_period.end_date, false)
    ON CONFLICT (company_id, start_date, end_date) DO UPDATE SET is_locked = false
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
  END IF;

  IF p_today > v_active.end_date THEN
    UPDATE payroll_periods SET is_locked = true WHERE id = v_active.id;
    SELECT * INTO v_period FROM compute_payroll_period(v_start_day, v_active.end_date + 1) LIMIT 1;
    INSERT INTO payroll_periods (company_id, start_date, end_date, is_locked)
    VALUES (p_company_id, v_period.start_date, v_period.end_date, false)
    ON CONFLICT (company_id, start_date, end_date) DO NOTHING
    RETURNING id INTO v_new_id;
    IF v_new_id IS NULL THEN
      SELECT id INTO v_new_id FROM payroll_periods
      WHERE company_id = p_company_id AND start_date = v_period.start_date AND end_date = v_period.end_date;
    END IF;
    RETURN v_new_id;
  END IF;

  RETURN v_active.id;
END;
$$;

COMMENT ON FUNCTION ensure_active_payroll_period(text, date) IS
  'Idempotent: ensures one active period for company containing p_today; locks ended period and creates next if needed.';

-- Backwards-compatibility overload: accept text company_id and cast to uuid
CREATE OR REPLACE FUNCTION ensure_active_payroll_period(
  p_company_id text,
  p_today date
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN ensure_active_payroll_period(p_company_id::uuid, p_today);
END;
$$;

-- ===== 20250101000003_payroll_period_jobs_trigger.sql =====

-- Compute payroll period for a company and reference date (local date in company timezone).
-- Returns the period that contains p_reference_date.
-- start_date: most recent date with day = payroll_start_day (clamped to last day of month).
-- end_date: day before next period's start_date.

CREATE OR REPLACE FUNCTION compute_payroll_period(
  p_payroll_start_day int,
  p_reference_date date
)
RETURNS TABLE (start_date date, end_date date)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_ref_month_start     date;
  v_ref_month_end      date;
  v_ref_day            int;
  v_start_date         date;
  v_next_month_start   date;
  v_next_month_end     date;
  v_next_start_offset  int;
  v_next_start         date;
  v_prev_month_start   date;
  v_prev_month_end     date;
BEGIN
  p_payroll_start_day := least(31, greatest(1, p_payroll_start_day));
  v_ref_month_start   := date_trunc('month', p_reference_date)::date;
  v_ref_month_end     := (v_ref_month_start + interval '1 month' - interval '1 day')::date;
  v_ref_day           := extract(day FROM p_reference_date)::int;

  IF v_ref_day >= p_payroll_start_day THEN
    v_start_date := v_ref_month_start + least(p_payroll_start_day - 1, v_ref_month_end - v_ref_month_start);
  ELSE
    v_prev_month_start := (v_ref_month_start - interval '1 month')::date;
    v_prev_month_end   := v_ref_month_start - 1;
    v_start_date       := v_prev_month_start + least(p_payroll_start_day - 1, v_prev_month_end - v_prev_month_start);
  END IF;

  v_next_month_start  := (date_trunc('month', v_start_date) + interval '1 month')::date;
  v_next_month_end    := (v_next_month_start + interval '1 month' - interval '1 day')::date;
  v_next_start_offset := least(p_payroll_start_day - 1, v_next_month_end - v_next_month_start);
  v_next_start        := v_next_month_start + v_next_start_offset;
  start_date          := v_start_date;
  end_date            := v_next_start - 1;
  RETURN NEXT;
  RETURN;
END;
$$;

COMMENT ON FUNCTION compute_payroll_period(int, date) IS
  'Returns (start_date, end_date) of the payroll period containing p_reference_date for given payroll_start_day (1..31).';

-- Ensure exactly one active (unlocked) period for company containing p_today.
-- If active exists and p_today > active.end_date: lock it and create next period.
-- Idempotent: unique on (company_id, start_date, end_date) prevents duplicates.

CREATE OR REPLACE FUNCTION ensure_active_payroll_period(
  p_company_id uuid,
  p_today date
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_day   int;
  v_active      payroll_periods%rowtype;
  v_period      record;
  v_new_id      uuid;
BEGIN
  SELECT c.payroll_start_day INTO v_start_day
  FROM companies c WHERE c.id = p_company_id;
  IF v_start_day IS NULL THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND';
  END IF;

  SELECT * INTO v_active
  FROM payroll_periods
  WHERE company_id = p_company_id AND is_locked = false
  LIMIT 1;

  IF v_active.id IS NULL THEN
    SELECT * INTO v_period FROM compute_payroll_period(v_start_day, p_today) LIMIT 1;
    INSERT INTO payroll_periods (company_id, start_date, end_date, is_locked)
    VALUES (p_company_id, v_period.start_date, v_period.end_date, false)
    ON CONFLICT (company_id, start_date, end_date) DO UPDATE SET is_locked = false
    RETURNING id INTO v_new_id;
    RETURN v_new_id;
  END IF;

  IF p_today > v_active.end_date THEN
    UPDATE payroll_periods SET is_locked = true WHERE id = v_active.id;
    SELECT * INTO v_period FROM compute_payroll_period(v_start_day, v_active.end_date + 1) LIMIT 1;
    INSERT INTO payroll_periods (company_id, start_date, end_date, is_locked)
    VALUES (p_company_id, v_period.start_date, v_period.end_date, false)
    ON CONFLICT (company_id, start_date, end_date) DO NOTHING
    RETURNING id INTO v_new_id;
    IF v_new_id IS NULL THEN
      SELECT id INTO v_new_id FROM payroll_periods
      WHERE company_id = p_company_id AND start_date = v_period.start_date AND end_date = v_period.end_date;
    END IF;
    RETURN v_new_id;
  END IF;

  RETURN v_active.id;
END;
$$;

COMMENT ON FUNCTION ensure_active_payroll_period(text, date) IS
  'Idempotent: ensures one active period for company containing p_today; locks ended period and creates next if needed.';

-- Backwards-compatibility overload: accept text company_id and cast to uuid
CREATE OR REPLACE FUNCTION ensure_active_payroll_period(
  p_company_id text,
  p_today date
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN ensure_active_payroll_period(p_company_id::uuid, p_today);
END;
$$;

-- ===== 20250301000001_company_profile_logo.sql =====

-- Company profile: editable name and logo
-- Add logo_url to companies; name remains editable via app.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN logo_url text;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- companies table does not exist; create minimal one
    CREATE TABLE public.companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      logo_url text,
      created_at timestamptz DEFAULT now()
    );
END $$;

COMMENT ON COLUMN public.companies.logo_url IS 'Public URL of company logo (e.g. Supabase Storage company-logos bucket).';

-- ===== 20250301000002_company_logos_storage_policies.sql =====

-- Storage RLS: allow uploads and public read for company-logos bucket
-- Fixes: "new row violates row-level security policy" when uploading logos
-- Idempotent: drop first so migration can be re-run

DROP POLICY IF EXISTS "company_logos_upload" ON storage.objects;
CREATE POLICY "company_logos_upload"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;
CREATE POLICY "company_logos_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_update" ON storage.objects;
CREATE POLICY "company_logos_update"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_delete" ON storage.objects;
CREATE POLICY "company_logos_delete"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'company-logos');

-- ===== 20250301000003_currency_and_decimal.sql =====

-- Currency and decimal(12,2) for money fields.
-- currency_code on company: optional override; when NULL, app uses locale (TR→TRY, EN→USD, ES/FR/DE→EUR).
-- All money columns should be decimal(12,2) for consistency and no floating-point drift.

-- 1) Companies: add currency_code for future manual override (e.g. 'USD', 'TRY', 'EUR')
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'companies' AND column_name = 'currency_code'
    ) THEN
      ALTER TABLE companies ADD COLUMN currency_code char(3) DEFAULT NULL;
      COMMENT ON COLUMN companies.currency_code IS 'Optional override. When NULL, app uses locale (TR→TRY, EN→USD, ES/FR/DE→EUR).';
    END IF;
  END IF;
END $$;

-- 2) work_items.unit_price: ensure numeric(12,2) if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_items') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_items' AND column_name = 'unit_price') THEN
      ALTER TABLE work_items ALTER COLUMN unit_price TYPE numeric(12,2) USING (round((unit_price)::numeric, 2));
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3) jobs: if quantity is stored as integer, consider altering to numeric(12,2) for decimal quantities
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
--     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'quantity') THEN
--       ALTER TABLE jobs ALTER COLUMN quantity TYPE numeric(12,2) USING quantity::numeric(12,2);
--     END IF;
--   END IF;
-- END $$;

-- ===== 20250302000001_audit_logs.sql =====

-- MVP Audit Log: immutable "who did what, when" for critical actions.
-- Requires Supabase Auth (auth.uid()). For SELECT by role we use public.profiles (id = auth.uid(), role, company_id);
-- App should upsert into profiles on login so RLS can allow CM/PM to see all, TL to see own.

-- 1) Profiles: one row per auth user (id = auth.uid()). Populate on login for RLS.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  company_id uuid
);

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- 2) Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  period_id uuid,
  team_code text,
  project_id text,
  user_agent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_period_id ON public.audit_logs(period_id);

-- 3) RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- INSERT: authenticated users can insert only their own logs (actor_user_id must equal auth.uid())
CREATE POLICY audit_logs_insert_own
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

-- SELECT: Company Manager & Project Manager see all; Team Leader sees only own (actor_user_id = auth.uid())
CREATE POLICY audit_logs_select_by_role
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        (p.role IN ('companyManager', 'projectManager'))
        OR (p.role = 'teamLeader' AND audit_logs.actor_user_id = auth.uid())
      )
    )
  );

-- No UPDATE or DELETE policies → logs are immutable

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail. INSERT only; no UPDATE/DELETE.';

-- ===== 20250302000002_company_language.sql =====

-- Company-wide language: stored at company level. Only CM/PM can change it.
-- Team Leader: read-only. Company Manager & Project Manager: read + update language_code.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'language_code'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN language_code text NOT NULL DEFAULT 'en';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- companies table created in earlier migration
END $$;

-- Constrain to supported locales
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS chk_companies_language_code;
ALTER TABLE public.companies
  ADD CONSTRAINT chk_companies_language_code
  CHECK (language_code IN ('en', 'tr', 'es', 'fr', 'de'));

COMMENT ON COLUMN public.companies.language_code IS 'Company UI language. Only Company Manager and Project Manager can update.';

-- RLS for companies (if not already enabled)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policies so we can recreate conditionally
DROP POLICY IF EXISTS companies_select_own ON public.companies;
DROP POLICY IF EXISTS companies_select_anon_by_id ON public.companies;
DROP POLICY IF EXISTS companies_update_cm_pm ON public.companies;
DROP POLICY IF EXISTS companies_select_anon ON public.companies;
DROP POLICY IF EXISTS companies_update_anon ON public.companies;
-- When public.profiles exists: use role-based policies (authenticated = own company, CM/PM can update)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    CREATE POLICY companies_select_own ON public.companies FOR SELECT TO authenticated
      USING (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
    CREATE POLICY companies_update_cm_pm ON public.companies FOR UPDATE TO authenticated
      USING (
        id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Anon: allow read (fetch company language on app init) and update (persist language when app does not use Supabase Auth)
-- Frontend restricts language change to CM/PM only.
CREATE POLICY companies_select_anon ON public.companies FOR SELECT TO anon USING (true);
CREATE POLICY companies_update_anon ON public.companies FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ===== 20250302000003_profiles_for_auth.sql =====

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

-- ===== 20250302000004_rls_strict_multi_tenant.sql =====

-- RLS: Strict multi-tenant isolation. No USING (true). No cross-company access.
-- auth.users = identity; public.profiles = profile (id -> auth.users.id, company_id, role).
-- Admin override only via service_role key.

-- =============================================================================
-- 1. PUBLIC.COMPANIES – Remove always-true (anon) policies
-- =============================================================================
DROP POLICY IF EXISTS companies_select_anon ON public.companies;
DROP POLICY IF EXISTS companies_update_anon ON public.companies;

-- Authenticated policies (created in 20250302000002) remain:
-- companies_select_own: SELECT where id = (SELECT company_id FROM profiles WHERE id = auth.uid())
-- companies_update_cm_pm: UPDATE only for CM/PM and only their company

-- =============================================================================
-- 2. PUBLIC.PROFILES – Only if table exists. Strict CM policy (no WITH CHECK true).
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS profiles_update_cm_same_company ON public.profiles;
    CREATE POLICY profiles_update_cm_same_company ON public.profiles
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- =============================================================================
-- 3. PUBLIC.USERS – If table exists, enable RLS and strict own-row-only policies
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS users_select_own ON public.users;
    CREATE POLICY users_select_own ON public.users
      FOR SELECT TO authenticated
      USING (id = auth.uid()::text);

    DROP POLICY IF EXISTS users_update_own ON public.users;
    CREATE POLICY users_update_own ON public.users
      FOR UPDATE TO authenticated
      USING (id = auth.uid()::text)
      WITH CHECK (id = auth.uid()::text);

    DROP POLICY IF EXISTS users_insert_own ON public.users;
    CREATE POLICY users_insert_own ON public.users
      FOR INSERT TO authenticated
      WITH CHECK (id = auth.uid()::text);

    -- Remove any always-true policies if they exist
    DROP POLICY IF EXISTS users_select_anon ON public.users;
    DROP POLICY IF EXISTS users_update_anon ON public.users;
    DROP POLICY IF EXISTS users_insert_anon ON public.users;
  END IF;
END $$;

-- =============================================================================
-- Summary
-- =============================================================================
-- companies:  SELECT/UPDATE only for authenticated; row must be user's company.
-- profiles:   SELECT/UPDATE own (id = auth.uid()); CM/PM can UPDATE same-company with strict CHECK.
-- users:      If present, SELECT/UPDATE/INSERT only own row (id = auth.uid()).
-- No anon policies with USING (true). Service role bypasses RLS for admin override.
--
-- Note: After this migration, unauthenticated clients cannot read companies. If your
-- "register existing company" flow needs to look up company by id/name before signUp,
-- use an Edge Function or backend with service_role to perform that lookup.

-- ===== 20250302000005_companies_insert_and_unique_name.sql =====

-- Allow company creation at signup (anon INSERT). Uniqueness by company name (case-insensitive).
-- INSERT: anon can insert (new company signup flow runs before auth).
-- SELECT/UPDATE: still restricted by existing RLS (authenticated own-company only after 20250302000004).

-- Unique constraint: one company per normalized name (lower, trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_unique
  ON public.companies (lower(trim(name)));

-- Allow anon to insert (used when user creates new company before signUp)
DROP POLICY IF EXISTS companies_insert_anon ON public.companies;
CREATE POLICY companies_insert_anon ON public.companies
  FOR INSERT TO anon
  WITH CHECK (true);

-- ===== 20250302000006_companies_rls_ensure.sql =====

-- Ensure public.companies has minimal RLS policies so INSERT does not fail silently.
-- Run this if you have "RLS enabled but no policies" (all operations denied).
-- Company creation at signup runs as anon (before signUp), so anon needs INSERT.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 1) INSERT: anon can insert (signup flow creates company before auth)
DROP POLICY IF EXISTS companies_insert_anon ON public.companies;
CREATE POLICY companies_insert_anon ON public.companies
  FOR INSERT TO anon
  WITH CHECK (true);

-- 2) SELECT: authenticated user can only see their own company (requires profiles)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP POLICY IF EXISTS companies_select_own ON public.companies;
    CREATE POLICY companies_select_own ON public.companies
      FOR SELECT TO authenticated
      USING (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- 3) UPDATE: authenticated CM/PM can update only their company
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP POLICY IF EXISTS companies_update_cm_pm ON public.companies;
    CREATE POLICY companies_update_cm_pm ON public.companies
      FOR UPDATE TO authenticated
      USING (
        id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- ===== 20250302000007_profiles_email_and_cm_select.sql =====

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

-- ===== 20250401000001_campaigns_vehicles_equipment_work_items_materials.sql =====

-- =============================================================================
-- Migration: Campaigns, Vehicles, Equipment, Work Items, Materials
-- Bağımlılık: public.companies (20250101 veya 20250301 ile oluşturulmuş olmalı)
-- Bu tablolar şirket bazlı ana veri; RLS sonraki migration'da.
-- =============================================================================

-- Önce public.companies var mı kontrol et; yoksa net hata ver
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    RAISE EXCEPTION '20250401000001: public.companies yok. Önce 20250101000001, 20250301000001, 20250302000001 migration''larını çalıştırın.';
  END IF;
END $$;

-- 1) Campaigns – şirket kampanyaları (proje grupları)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_company_id ON public.campaigns (company_id);
COMMENT ON TABLE public.campaigns IS 'Company campaigns; projects are linked to a campaign.';

-- 2) Vehicles – şirket araçları (ekiplere atanabilir)
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plate_number text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  description text
);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON public.vehicles (company_id);
COMMENT ON TABLE public.vehicles IS 'Company vehicles; can be assigned to teams.';

-- 3) Equipment – ekipman (iş kaydında equipmentIds ile referans)
CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_equipment_company_id ON public.equipment (company_id);
COMMENT ON TABLE public.equipment IS 'Company equipment; referenced in job records.';

-- 4) Work Items – iş kalemleri (birim fiyat, birim türü)
CREATE TABLE IF NOT EXISTS public.work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  unit_type text NOT NULL,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_work_items_company_id ON public.work_items (company_id);
COMMENT ON TABLE public.work_items IS 'Work item definitions; unit price and type for job valuation.';

-- 5) Materials – basit malzeme kaydı (fiyat; bazı ekranlarda kullanılır)
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_materials_company_id ON public.materials (company_id);
COMMENT ON TABLE public.materials IS 'Legacy material records (code, price); material_stock is the main stock table.';

-- ===== 20250401000002_teams_and_projects.sql =====

-- =============================================================================
-- Migration: Teams, Projects
-- Bağımlılık: companies, profiles, vehicles, campaigns
-- Teams: leader_id -> profiles(id), vehicle_id -> vehicles(id)
-- Projects: campaign_id -> campaigns(id), created_by -> profiles(id), completed_by -> profiles(id)
-- =============================================================================

-- 1) Teams – ekipler (lider, araç, onay durumu, manuel üyeler json)
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  leader_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_ids uuid[] DEFAULT '{}',
  members_manual jsonb DEFAULT '[]',
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_teams_company_code UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_teams_company_id ON public.teams (company_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON public.teams (leader_id);
CREATE INDEX IF NOT EXISTS idx_teams_company_leader ON public.teams (company_id, leader_id);
COMMENT ON TABLE public.teams IS 'Teams; Team Leader sees only rows where leader_id = auth.uid().';

-- 2) Projects – projeler (kampanya, yıl, dış ID, durum, tamamlayan)
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  project_year int NOT NULL CHECK (project_year >= 2000 AND project_year <= 2100),
  external_project_id text NOT NULL,
  received_date date NOT NULL,
  name text,
  description text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects (company_id);
CREATE INDEX IF NOT EXISTS idx_projects_campaign_id ON public.projects (campaign_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_status ON public.projects (company_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_company_year_ext ON public.projects (company_id, project_year, external_project_id);
COMMENT ON TABLE public.projects IS 'Projects; key = (company, year, external_project_id).';

-- ===== 20250401000003_material_stock_allocations_audit.sql =====

-- =============================================================================
-- Migration: Material Stock, Team Material Allocations, Material Audit Log
-- Bağımlılık: companies, teams (allocations için)
-- material_stock: stok kalemleri (direk, kablo, boru, özel vb.)
-- team_material_allocations: ekip zimmeti (merkez -> ekip dağıtım)
-- material_audit_log: malzeme hareket denetim kayıtları
-- =============================================================================

-- 1) Material stock items – stok kalemleri (kablo metre/adet, spool, harici vb.)
CREATE TABLE IF NOT EXISTS public.material_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  main_type text NOT NULL,
  custom_group_name text,
  name text NOT NULL,
  size_or_capacity text,
  stock_qty numeric(12,2) CHECK (stock_qty IS NULL OR stock_qty >= 0),
  is_cable boolean DEFAULT false,
  cable_category text CHECK (cable_category IS NULL OR cable_category IN ('ic', 'yeraltı', 'havai')),
  capacity_label text,
  spool_id text,
  length_total numeric(12,2) CHECK (length_total IS NULL OR length_total >= 0),
  length_remaining numeric(12,2) CHECK (length_remaining IS NULL OR length_remaining >= 0),
  is_external boolean DEFAULT false,
  external_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_material_stock_company_id ON public.material_stock (company_id);
CREATE INDEX IF NOT EXISTS idx_material_stock_spool_id ON public.material_stock (company_id, spool_id) WHERE spool_id IS NOT NULL;
COMMENT ON TABLE public.material_stock IS 'Stock items: poles, cables (m/spool), pipes, etc.; team allocations reference this.';

-- 2) Team material allocations – ekip zimmeti (dağıtılan miktar)
CREATE TABLE IF NOT EXISTS public.team_material_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  material_stock_item_id uuid NOT NULL REFERENCES public.material_stock(id) ON DELETE RESTRICT,
  quantity_meters numeric(12,2) CHECK (quantity_meters IS NULL OR quantity_meters >= 0),
  quantity_pcs numeric(12,2) CHECK (quantity_pcs IS NULL OR quantity_pcs >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_allocation_quantity CHECK (
    (quantity_meters IS NOT NULL AND quantity_meters > 0) OR (quantity_pcs IS NOT NULL AND quantity_pcs > 0)
  )
);
CREATE INDEX IF NOT EXISTS idx_team_material_allocations_company_id ON public.team_material_allocations (company_id);
CREATE INDEX IF NOT EXISTS idx_team_material_allocations_team_id ON public.team_material_allocations (team_id);
CREATE INDEX IF NOT EXISTS idx_team_material_allocations_material ON public.team_material_allocations (material_stock_item_id);
COMMENT ON TABLE public.team_material_allocations IS 'Material allocated to teams (from central stock); job material usage can reference by team_zimmet_id.';

-- 3) Material audit log – malzeme hareket denetimi
CREATE TABLE IF NOT EXISTS public.material_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN (
    'STOCK_ADD', 'STOCK_EDIT', 'STOCK_DELETE', 'DISTRIBUTE_TO_TEAM',
    'RETURN_TO_STOCK', 'TRANSFER_BETWEEN_TEAMS', 'STOCK_ADJUSTMENT'
  )),
  actor_user_id uuid NOT NULL,
  actor_role text,
  material_stock_item_id uuid NOT NULL REFERENCES public.material_stock(id) ON DELETE CASCADE,
  from_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  to_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  qty_count numeric(12,2),
  qty_meters numeric(12,2),
  spool_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_material_audit_log_company_id ON public.material_audit_log (company_id);
CREATE INDEX IF NOT EXISTS idx_material_audit_log_created_at ON public.material_audit_log (company_id, created_at DESC);
COMMENT ON TABLE public.material_audit_log IS 'Audit trail for material movements (stock, distribute, return, transfer).';

-- ===== 20250401000004_delivery_notes.sql =====

-- =============================================================================
-- Migration: Delivery Notes, Delivery Note Items
-- Bağımlılık: companies, material_stock
-- İrsaliye: teslim alındığında oluşturulur; kalemler stok kalemi + miktar.
-- =============================================================================

-- 1) Delivery notes – irsaliye başlığı
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier text NOT NULL,
  received_date date NOT NULL,
  irsaliye_no text NOT NULL,
  received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_company_id ON public.delivery_notes (company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_received_date ON public.delivery_notes (company_id, received_date DESC);
COMMENT ON TABLE public.delivery_notes IS 'Delivery notes (irsaliye); immutable after receive.';

-- 2) Delivery note items – irsaliye kalemleri (stok kalemi + miktar + birim)
CREATE TABLE IF NOT EXISTS public.delivery_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  material_stock_item_id uuid NOT NULL REFERENCES public.material_stock(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  quantity_unit text NOT NULL CHECK (quantity_unit IN ('m', 'pcs')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON public.delivery_note_items (delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_material ON public.delivery_note_items (material_stock_item_id);
COMMENT ON TABLE public.delivery_note_items IS 'Line items of a delivery note; link to material_stock and quantity.';

-- ===== 20250401000005_jobs_and_payroll_period_settings.sql =====

-- =============================================================================
-- Migration: Jobs, Payroll Period Settings
-- Bağımlılık: companies, projects, teams, work_items, payroll_periods, profiles
-- jobs: iş kayıtları; payroll trigger (20250101000003) job_date/date ile payroll_period_id atar.
-- payroll_period_settings: şirket bazlı hakediş dönemi ayarı (start_day_of_month).
-- =============================================================================

-- 1) Jobs – iş kayıtları (tarih, proje, ekip, iş kalemi, miktar, malzeme/ekipman, onay)
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_date date NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  material_ids uuid[] DEFAULT '{}',
  material_usages jsonb DEFAULT '[]',
  equipment_ids uuid[] DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  stock_deducted boolean DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payroll_period_id uuid REFERENCES public.payroll_periods(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs (company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company_date ON public.jobs (company_id, job_date);
CREATE INDEX IF NOT EXISTS idx_jobs_company_status ON public.jobs (company_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_team_id ON public.jobs (team_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON public.jobs (project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_payroll_period_id ON public.jobs (payroll_period_id);
COMMENT ON TABLE public.jobs IS 'Job records; payroll trigger sets payroll_period_id from date. TL sees only own teams.';

-- Payroll trigger expects job_date or date; we use "date". Trigger in 20250101000003 references NEW.date.
-- After this migration, re-create trigger if needed (trigger creation is conditional on jobs existing).

-- 2) Payroll period settings – şirket başına dönem başlangıç günü (ayın kaçı)
CREATE TABLE IF NOT EXISTS public.payroll_period_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  start_day_of_month int NOT NULL CHECK (start_day_of_month >= 1 AND start_day_of_month <= 31),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.payroll_period_settings IS 'Per-company payroll period start day (e.g. 20 = period 20th to 19th next month).';

-- Ensure payroll trigger is attached to jobs (idempotent; 20250101000003 created the function)
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'payroll_period_id')
     AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'jobs_resolve_payroll_period')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'jobs' AND t.tgname = 'trg_jobs_resolve_payroll_period') THEN
    CREATE TRIGGER trg_jobs_resolve_payroll_period
      BEFORE INSERT OR UPDATE OF company_id, job_date
      ON public.jobs
      FOR EACH ROW
      EXECUTE PROCEDURE jobs_resolve_payroll_period();
  END IF;
END $mig$;

-- ===== 20250401000006_rls_all_new_tables.sql =====

-- =============================================================================
-- RLS: Tüm yeni tablolar için çok kiracılı erişim kontrolü
-- Tablo yoksa atlanır (IF EXISTS); böylece 000001-000005 tam çalışmamış olsa da hata vermez.
-- =============================================================================

DO $rls$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
    ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS campaigns_company ON public.campaigns;
    CREATE POLICY campaigns_company ON public.campaigns FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
    ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS vehicles_company ON public.vehicles;
    CREATE POLICY vehicles_company ON public.vehicles FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipment') THEN
    ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS equipment_company ON public.equipment;
    CREATE POLICY equipment_company ON public.equipment FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_items') THEN
    ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS work_items_company ON public.work_items;
    CREATE POLICY work_items_company ON public.work_items FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materials') THEN
    ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS materials_company ON public.materials;
    CREATE POLICY materials_company ON public.materials FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teams') THEN
    ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS teams_company_or_leader ON public.teams;
    CREATE POLICY teams_company_or_leader ON public.teams FOR ALL TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager') OR leader_id = auth.uid())
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager') OR leader_id = auth.uid())
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS projects_company ON public.projects;
    CREATE POLICY projects_company ON public.projects FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_stock') THEN
    ALTER TABLE public.material_stock ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS material_stock_company ON public.material_stock;
    CREATE POLICY material_stock_company ON public.material_stock FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_material_allocations') THEN
    ALTER TABLE public.team_material_allocations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS team_material_allocations_company_or_leader ON public.team_material_allocations;
    CREATE POLICY team_material_allocations_company_or_leader ON public.team_material_allocations FOR ALL TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_audit_log') THEN
    ALTER TABLE public.material_audit_log ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS material_audit_log_company ON public.material_audit_log;
    CREATE POLICY material_audit_log_company ON public.material_audit_log FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_notes') THEN
    ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS delivery_notes_company ON public.delivery_notes;
    CREATE POLICY delivery_notes_company ON public.delivery_notes FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_note_items') THEN
    ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS delivery_note_items_via_note ON public.delivery_note_items;
    CREATE POLICY delivery_note_items_via_note ON public.delivery_note_items FOR ALL TO authenticated
      USING (delivery_note_id IN (SELECT id FROM public.delivery_notes WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())))
      WITH CHECK (delivery_note_id IN (SELECT id FROM public.delivery_notes WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS jobs_company_or_leader ON public.jobs;
    CREATE POLICY jobs_company_or_leader ON public.jobs FOR ALL TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_period_settings') THEN
    ALTER TABLE public.payroll_period_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS payroll_period_settings_company ON public.payroll_period_settings;
    CREATE POLICY payroll_period_settings_company ON public.payroll_period_settings FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_periods') THEN
    ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS payroll_periods_company ON public.payroll_periods;
    CREATE POLICY payroll_periods_company ON public.payroll_periods FOR ALL TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $rls$;

-- ===== 20250401000007_jobs_resolve_payroll_period_function.sql =====

-- =============================================================================
-- Migration: jobs_resolve_payroll_period trigger function (missing from 20250101/20250401)
-- Call after 20250401000005 (jobs table) and 20250101000002 (ensure_active_payroll_period).
-- Ensures job rows get payroll_period_id set on INSERT/UPDATE from job_date.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.jobs_resolve_payroll_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.payroll_period_id := ensure_active_payroll_period(NEW.company_id, NEW.job_date);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.jobs_resolve_payroll_period() IS
  'Trigger: set payroll_period_id on jobs from job_date using company payroll_start_day.';

-- Attach trigger to jobs if not already present
DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'payroll_period_id')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'jobs' AND t.tgname = 'trg_jobs_resolve_payroll_period') THEN
    CREATE TRIGGER trg_jobs_resolve_payroll_period
      BEFORE INSERT OR UPDATE OF company_id, job_date
      ON public.jobs
      FOR EACH ROW
      EXECUTE FUNCTION public.jobs_resolve_payroll_period();
  END IF;
END $mig$;

-- ===== 20250501000001_profiles_basic_policies.sql =====

-- Basic RLS policies for public.profiles (idempotent).
-- Only: profiles_insert_own, profiles_select_own, profiles_update_own.
-- No same_company / cm / pm / admin / manager policies.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

