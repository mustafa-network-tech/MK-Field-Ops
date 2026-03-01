# Payroll rollover (scheduled)

Runs daily to ensure each company has exactly one active (unlocked) payroll period. Locks the period that just ended and creates the next one.

## Schedule (Option B – Supabase Dashboard)

1. In Supabase: **Database** → **Extensions** → enable `pg_cron` if you want DB cron, **or** use **Edge Functions** → **payroll-rollover** → **Schedule**.
2. Recommended: trigger once per day after midnight UTC (e.g. `0 5 * * *` for 00:05 UTC), or use Supabase “Schedule” with cron expression.
3. The function uses `SUPABASE_SERVICE_ROLE_KEY` so it can call `ensure_active_payroll_period` for all companies.

## Invoke manually

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/payroll-rollover" \
  -H "Authorization: Bearer <ANON_OR_SERVICE_ROLE_KEY>"
```

## Response

`{ "ok": true, "processed": N, "results": [ { "companyId", "timezone", "localDate", "periodId" }, ... ] }`

Errors per company are in `results[].error`.
