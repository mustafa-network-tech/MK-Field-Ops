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
