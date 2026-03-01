-- Jobs: BEFORE INSERT/UPDATE trigger to set payroll_period_id and reject locked periods.
-- Assumes jobs table has: company_id uuid, job_date date (or "date" column – adapt name below), payroll_period_id uuid.

-- Use job_date if that column exists; otherwise fall back to "date" for compatibility.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'company_id') THEN
    RAISE NOTICE 'jobs.company_id missing – skip payroll trigger';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'job_date')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'date') THEN
    RAISE NOTICE 'jobs.job_date/date missing – skip payroll trigger';
    RETURN;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION jobs_resolve_payroll_period()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id    uuid;
  v_job_date     date;
  v_start_day    int;
  v_period_id    uuid;
  v_period       payroll_periods%rowtype;
  v_computed     record;
BEGIN
  v_company_id := COALESCE(NEW.company_id, (SELECT company_id FROM companies LIMIT 1));
  v_job_date   := COALESCE(NEW.job_date, (NEW.date)::date);

  IF v_company_id IS NULL OR v_job_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.payroll_start_day INTO v_start_day
  FROM companies c WHERE c.id = v_company_id;
  IF v_start_day IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_period
  FROM payroll_periods pp
  WHERE pp.company_id = v_company_id
    AND pp.start_date <= v_job_date
    AND pp.end_date >= v_job_date
  ORDER BY pp.is_locked ASC
  LIMIT 1;

  IF v_period.id IS NOT NULL THEN
    IF v_period.is_locked THEN
      RAISE EXCEPTION 'PAYROLL_PERIOD_LOCKED';
    END IF;
    NEW.payroll_period_id := v_period.id;
    RETURN NEW;
  END IF;

  v_period_id := ensure_active_payroll_period(v_company_id, v_job_date);

  SELECT * INTO v_period
  FROM payroll_periods
  WHERE id = v_period_id;
  IF v_period.is_locked THEN
    RAISE EXCEPTION 'PAYROLL_PERIOD_LOCKED';
  END IF;
  NEW.payroll_period_id := v_period.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_resolve_payroll_period ON jobs;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'payroll_period_id') THEN
    CREATE TRIGGER trg_jobs_resolve_payroll_period
      BEFORE INSERT OR UPDATE OF company_id, job_date, date
      ON jobs
      FOR EACH ROW
      EXECUTE PROCEDURE jobs_resolve_payroll_period();
  END IF;
END $$;

COMMENT ON FUNCTION jobs_resolve_payroll_period() IS
  'Resolves payroll_period_id from job date; raises PAYROLL_PERIOD_LOCKED if period is locked.';
