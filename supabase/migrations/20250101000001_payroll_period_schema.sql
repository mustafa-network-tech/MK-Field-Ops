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

-- 2) Payroll periods table
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
