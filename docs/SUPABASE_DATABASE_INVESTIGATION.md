# Supabase database investigation

This document summarizes the investigation of your Supabase setup and possible database issues.

---

## 1. Environment / connection

- **Config:** The app uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `src/services/supabaseClient.ts`. If either is missing, `supabase` is `null` and the app uses **only localStorage** (no Supabase Auth, no companies/profiles/audit in Supabase).
- **No `.env` in repo:** `.env` is gitignored, so local dev needs a `.env` (or `.env.local`) with:
  ```env
  VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
  VITE_SUPABASE_ANON_KEY=your_anon_key
  ```
- **Check:** In the browser console on app load you should see `[Supabase] project ref: YOUR_PROJECT_REF`. If you don’t, Supabase is not configured and all “database” usage is local.

**Action:** Create `.env` (or `.env.local`) with the two variables from Supabase Dashboard → Project Settings → API, then restart `npm run dev`.

---

## 2. What actually uses Supabase today

| Feature | Uses Supabase? | Table / API |
|--------|-----------------|-------------|
| Login / Register | Yes (when env set) | Auth + `profiles`, `companies` |
| Company language | Yes | `companies` (language_code) |
| Company logo upload | Yes | Storage bucket `company-logos` |
| Audit logs | Yes | `audit_logs` |
| Jobs, teams, projects, materials, etc. | **No** | Still **localStorage** only |

So “databases from Supabase” currently means: **Auth, profiles, companies, audit_logs, and company language**. All other data (jobs, teams, projects, vehicles, materials, work items, delivery notes, etc.) is still in the browser’s localStorage. The migrations for those tables exist in `supabase/migrations/` but the app does not yet read/write them to Supabase.

---

## 3. Schema / migration issues

### 3.1 Company ID type mismatch (important)

- **companies:** Created in `20250301000001_company_profile_logo.sql` with `id uuid`.
- **Other tables:** `payroll_periods`, `teams`, `projects`, `jobs`, etc. use `company_id text NOT NULL REFERENCES public.companies(id)`.

In PostgreSQL the referencing column type must match the referenced column. So `company_id text` cannot reference `companies(id uuid)` — the migration would fail unless your Supabase project was created differently (e.g. `companies.id` as `text`).

**What to do:**

- In Supabase SQL Editor, run:
  ```sql
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'id';
  ```
- If the result is `uuid`: you have a type mismatch. Either:
  - Change `companies.id` to `text` (and adjust `profiles.company_id` to `text` to match), **or**
  - Change all `company_id` columns to `uuid` and ensure the app always sends UUIDs.
- If the result is `text`: you’re consistent; no change needed.

### 3.2 Missing trigger function (fixed in repo)

- The trigger `trg_jobs_resolve_payroll_period` (in `20250401000005_jobs_and_payroll_period_settings.sql`) calls `jobs_resolve_payroll_period()`, but that function was **not defined** in any migration.
- So the trigger was never created, and `jobs.payroll_period_id` would never be set automatically when inserting/updating jobs.

A new migration was added that creates `jobs_resolve_payroll_period`. After running all migrations in order (see `docs/MIGRATION_RUN_ORDER.md`), run the new migration as well so the trigger works when you start writing jobs to Supabase.

### 3.3 Profile trigger and company_id type

- `handle_new_auth_user()` (in `20250302000003_profiles_for_auth.sql` and `20250302000007_profiles_email_and_cm_select.sql`) inserts into `profiles` using `(new.raw_user_meta_data->>'company_id')::uuid`.
- So `profiles.company_id` is `uuid`. If you switch `companies.id` to `text`, you must also change `profiles.company_id` to `text` and use the value without `::uuid` in the trigger.

---

## 4. Migration order and RLS

- Run migrations in the order in **`docs/MIGRATION_RUN_ORDER.md`** (19 files, then the new one for the payroll trigger function).
- RLS is set so that:
  - Company Manager / Project Manager see company-scoped data.
  - Team Leader sees only their teams (and related jobs, etc.).
- If you see “permission denied” or “row-level security” errors, check that the logged-in user has a row in `profiles` with the correct `company_id` and `role`, and that the right RLS policies exist (e.g. `20250302000004`, `20250302000006`, `20250401000006`).

---

## 5. Quick checklist

- [ ] `.env` (or `.env.local`) has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- [ ] Browser console shows `[Supabase] project ref: ...` on load.
- [ ] All migrations from `MIGRATION_RUN_ORDER.md` applied in order, plus the new payroll trigger migration.
- [ ] In Supabase, `companies.id` and all `company_id` columns are the same type (all `text` or all `uuid`).
- [ ] Storage bucket `company-logos` exists and policies applied (see `docs/STORAGE_SETUP.md`).
- [ ] For full DB usage: app code still needs to be updated to read/write jobs, teams, projects, etc. from Supabase instead of localStorage.

If you want, the next step can be: (1) a small migration to align `companies.id` and `profiles.company_id` to `text`, or (2) a short plan to switch jobs/teams/projects to Supabase.
