-- =============================================================================
-- mk-score 00018 - Company closure lifecycle (30-day retention)
-- =============================================================================
-- Behavior:
--   - Company Manager can request closure -> access blocks immediately.
--   - Data retained for 30 days (purge_after).
--   - Within retention, CM can reopen if plan is still valid (plan_end_date > now).
--   - If plan expired, renewal is required first; then reopen is allowed.
--   - A service function purges due closed companies (hard delete) after retention.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'closure_requested_at'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN closure_requested_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'purge_after'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN purge_after timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'closed_by_user_id'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN closed_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.request_company_closure(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  me record;
BEGIN
  SELECT id, company_id, role INTO me
  FROM public.profiles
  WHERE id = auth.uid();

  IF me.id IS NULL OR me.role <> 'companyManager' OR me.company_id IS DISTINCT FROM p_company_id THEN
    RETURN false;
  END IF;

  UPDATE public.companies c
  SET
    subscription_status = 'closed',
    closure_requested_at = now(),
    purge_after = now() + interval '30 days',
    closed_by_user_id = auth.uid()
  WHERE c.id = p_company_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_company_within_retention(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  me record;
  c record;
BEGIN
  SELECT id, company_id, role INTO me
  FROM public.profiles
  WHERE id = auth.uid();

  IF me.id IS NULL OR me.role <> 'companyManager' OR me.company_id IS DISTINCT FROM p_company_id THEN
    RETURN false;
  END IF;

  SELECT id, purge_after, plan_end_date
  INTO c
  FROM public.companies
  WHERE id = p_company_id;

  IF c.id IS NULL OR c.purge_after IS NULL OR c.purge_after <= now() THEN
    RETURN false;
  END IF;

  -- Reopen is allowed only when there is remaining paid period.
  -- If plan expired, customer must renew first (renew updates plan_end_date).
  IF c.plan_end_date IS NULL OR c.plan_end_date <= now() THEN
    RETURN false;
  END IF;

  UPDATE public.companies
  SET
    subscription_status = 'active',
    closure_requested_at = null,
    purge_after = null,
    closed_by_user_id = null
  WHERE id = p_company_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_closed_companies_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  WITH deleted AS (
    DELETE FROM public.companies c
    WHERE c.subscription_status = 'closed'
      AND c.purge_after IS NOT NULL
      AND c.purge_after <= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM deleted;

  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.request_company_closure(uuid) IS
  'CM requests closure: blocks access immediately; sets 30-day retention purge_after.';
COMMENT ON FUNCTION public.reopen_company_within_retention(uuid) IS
  'CM reopens within retention if plan has remaining time (plan_end_date > now).';
COMMENT ON FUNCTION public.purge_closed_companies_due() IS
  'Service-side purge job: hard deletes companies whose retention window expired.';

REVOKE ALL ON FUNCTION public.request_company_closure(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_company_closure(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.request_company_closure(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.request_company_closure(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reopen_company_within_retention(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_company_within_retention(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reopen_company_within_retention(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_company_within_retention(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.purge_closed_companies_due() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_closed_companies_due() FROM anon;
REVOKE ALL ON FUNCTION public.purge_closed_companies_due() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_closed_companies_due() TO service_role;
