-- Plan start/end dates on companies: set when plan is chosen (e.g. at company creation or renewal).
-- plan_start_date = when the current plan period started; plan_end_date = when it ends (e.g. +1 month or +1 year).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'plan_start_date') THEN
    ALTER TABLE public.companies ADD COLUMN plan_start_date timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'plan_end_date') THEN
    ALTER TABLE public.companies ADD COLUMN plan_end_date timestamptz;
  END IF;
END $$;

COMMENT ON COLUMN public.companies.plan_start_date IS 'When the current plan period started (e.g. company creation or last renewal).';
COMMENT ON COLUMN public.companies.plan_end_date IS 'When the current plan period ends; after this date company enters suspended then closed if not renewed.';
