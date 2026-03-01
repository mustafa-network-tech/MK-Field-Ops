# Payroll Period Rollover – Deliverables Summary

## 1. SQL migrations

### `migrations/20250101000001_payroll_period_schema.sql`
- **companies:** `timezone` (default `Europe/Istanbul`), `payroll_start_day` (1–31). Creates table if missing.
- **payroll_periods:** `id`, `company_id`, `start_date`, `end_date`, `is_locked` (default false), `created_at`. Unique `(company_id, start_date, end_date)`.
- **jobs:** Adds `payroll_period_id` if `jobs` table exists.

### `migrations/20250101000002_payroll_period_functions.sql`
- **`compute_payroll_period(p_payroll_start_day, p_reference_date)`**  
  Returns `(start_date, end_date)` for the period containing the reference date. `start_date` = most recent day = `payroll_start_day` (clamped to last day of month). `end_date` = day before next period start.
- **`ensure_active_payroll_period(p_company_id, p_today)`**  
  Idempotent: finds active (unlocked) period; if none, creates period containing `p_today`; if active exists and `p_today > active.end_date`, locks it and creates next period. Uses `ON CONFLICT (company_id, start_date, end_date)` to avoid duplicates.

### `migrations/20250101000003_payroll_period_jobs_trigger.sql`
- **`jobs_resolve_payroll_period()`** (BEFORE INSERT OR UPDATE on `company_id`, `job_date`, `date`):
  - Resolves period for `NEW.job_date` (or `NEW.date`); prefers unlocked period.
  - If matched period is locked → **raises `PAYROLL_PERIOD_LOCKED`**.
  - Else sets `NEW.payroll_period_id`.
  - If no period exists, calls `ensure_active_payroll_period(company_id, job_date)` then re-resolves.

---

## 2. Edge Function (Option B)

**`functions/payroll-rollover/index.ts`**
- Iterates all companies with `payroll_start_day` set.
- For each: computes **local date** in company `timezone` (IANA, default `Europe/Istanbul`).
- Calls `ensure_active_payroll_period(company_id, p_today)` via RPC.
- Returns `{ ok, processed, results }` per company.

**Schedule:** Supabase Dashboard → Edge Functions → payroll-rollover → set cron (e.g. daily `0 5 * * *`). Requires `Authorization: Bearer <key>`.

---

## 3. Frontend

- **jobService.ts:** `PAYROLL_PERIOD_LOCKED_ERROR = 'jobs.payrollPeriodClosed'`, `normalizeJobApiError(apiError)` maps DB/API `PAYROLL_PERIOD_LOCKED` to that i18n key. Use when integrating Supabase job insert/update:  
  `if (error) return { ok: false, error: normalizeJobApiError(error) ?? error.message };`
- **i18n:** EN: "This payroll period is closed. Please select a date in the active period." TR: "Bu hakediş dönemi kapatıldı. Lütfen aktif dönemde bir tarih seçin."
- **Payroll periods list:** `getPayrollPeriods(companyId)` returns periods sorted **desc by start_date** (newest first); active period first with `isActive: true`.

---

## 4. Run order

1. Apply migrations in order: `000001` → `000002` → `000003`.
2. Deploy Edge Function `payroll-rollover` and schedule it.
3. When switching job writes to Supabase, use `normalizeJobApiError()` on insert/update errors and show `t(result.error)` in JobEntry.
