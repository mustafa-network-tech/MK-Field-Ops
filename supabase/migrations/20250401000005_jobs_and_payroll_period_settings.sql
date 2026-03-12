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
