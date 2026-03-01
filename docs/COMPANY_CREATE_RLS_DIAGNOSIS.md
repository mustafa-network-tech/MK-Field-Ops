# Company creation + RLS diagnosis and fix

## Diagnosis

1. **createCompany flow**  
   - `authService.registerNewCompany()` inserts into `public.companies` (Supabase), then calls `signUp` with `company_id`.  
   - Company is created **before** auth, so the insert runs as **anon**.

2. **Why "company already exists" with zero rows**  
   - If RLS is enabled and **no policies** exist on `public.companies`, then:
     - **SELECT** returns no rows (or is denied).
     - **INSERT** is **denied** (no policy ⇒ deny).
   - The app only shows "company already exists" when Supabase returns error code **23505** (unique violation).  
   - If you see "company already exists" with zero rows, either:
     - The message is coming from somewhere else (e.g. old local check), or  
     - The **insert is failing for another reason** (e.g. RLS) and the UI is not showing the real error.  
   - With the new logging, check the browser console for `[Supabase] companies INSERT failed:` and the **code** (e.g. `42501` = permission denied / RLS).

3. **Silent failure**  
   - Previously the insert error was only returned as `error.message` and not logged.  
   - Now the full error (code, message, details, hint) is logged so RLS/permission errors are visible.

---

## Minimal policy requirements (public.companies)

| Operation | Role         | Policy intent |
|----------|--------------|----------------|
| **INSERT** | **anon**     | Allow so signup can create a company before `signUp`. |
| **SELECT** | **authenticated** | Allow only own company: `id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())`. |
| **UPDATE** | **authenticated** | Allow only CM/PM and only own company (same condition as SELECT + role check). |

- No `USING (true)` for SELECT/UPDATE (strict isolation).  
- INSERT for anon is the minimal exception so "create company" then "signUp" works without changing flow order.

---

## Corrected flow (no fallback on insert failure)

1. **Trim name**, check email not already in local store.
2. **Insert company** in Supabase (anon):
   - Body: `id` (uuid), `name`, `language_code`, `created_at`.
3. **On insert result:**
   - **Success** → `store.ensureCompany(data.id, data.name)`, then `signUp` with `company_id`, then return success.
   - **Error 23505** (unique on name) → return `auth.companyNameExists`.
   - **Any other error** → log full error, return `error.message` (no "company already exists", no silent continue).
4. No fallback that assumes company exists when insert fails.  
5. Local store is updated only after a successful insert.

---

## Migrations to run

- **20250302000005** – Unique index on `lower(trim(name))` + `companies_insert_anon` (INSERT for anon).  
- **20250302000006** – Ensures RLS is on and all three policies exist (insert anon, select/update authenticated). Safe to run even if some policies already exist.

After running these, company creation should either succeed or fail with a clear, logged error (e.g. RLS/permissions), and "company already exists" only for real unique violations.
