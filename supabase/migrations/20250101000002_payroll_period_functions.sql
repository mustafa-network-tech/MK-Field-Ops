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
