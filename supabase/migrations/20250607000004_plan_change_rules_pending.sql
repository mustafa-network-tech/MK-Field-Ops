-- Plan change rules: upgrade = effective immediately; downgrade = effective at end of current period.
-- pending_plan = scheduled downgrade; applied when plan_end_date is reached (via RPC or cron).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'pending_plan') THEN
    ALTER TABLE public.companies ADD COLUMN pending_plan text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'pending_plan_billing_cycle') THEN
    ALTER TABLE public.companies ADD COLUMN pending_plan_billing_cycle text;
  END IF;
END $$;

COMMENT ON COLUMN public.companies.pending_plan IS 'Scheduled plan for downgrade: applied at plan_end_date (starter | professional | enterprise). NULL if no pending change.';
COMMENT ON COLUMN public.companies.pending_plan_billing_cycle IS 'Billing cycle for the pending plan when applied: monthly | yearly.';

-- RPC: apply pending plan when current period has ended (now >= plan_end_date).
-- Sets plan = pending_plan, plan_start_date = old plan_end_date, plan_end_date = +1 month/year, clears pending_*.
CREATE OR REPLACE FUNCTION public.apply_pending_plan_if_due(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row companies%ROWTYPE;
  v_new_end timestamptz;
  v_interval interval;
BEGIN
  SELECT * INTO v_row FROM public.companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND OR v_row.pending_plan IS NULL OR v_row.plan_end_date IS NULL THEN
    RETURN;
  END IF;
  IF now() < v_row.plan_end_date THEN
    RETURN;
  END IF;
  IF v_row.pending_plan NOT IN ('starter', 'professional', 'enterprise') THEN
    UPDATE public.companies SET pending_plan = NULL, pending_plan_billing_cycle = NULL WHERE id = p_company_id;
    RETURN;
  END IF;
  v_interval := CASE WHEN v_row.pending_plan_billing_cycle = 'yearly' THEN interval '1 year' ELSE interval '1 month' END;
  v_new_end := v_row.plan_end_date + v_interval;
  UPDATE public.companies
  SET
    plan = v_row.pending_plan,
    plan_start_date = v_row.plan_end_date,
    plan_end_date = v_new_end,
    pending_plan = NULL,
    pending_plan_billing_cycle = NULL
  WHERE id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.apply_pending_plan_if_due(uuid) IS 'If company has pending_plan and plan_end_date has passed, apply downgrade: set plan, new period, clear pending.';
