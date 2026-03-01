-- Allow company creation at signup (anon INSERT). Uniqueness by company name (case-insensitive).
-- INSERT: anon can insert (new company signup flow runs before auth).
-- SELECT/UPDATE: still restricted by existing RLS (authenticated own-company only after 20250302000004).

-- Unique constraint: one company per normalized name (lower, trimmed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_unique
  ON public.companies (lower(trim(name)));

-- Allow anon to insert (used when user creates new company before signUp)
DROP POLICY IF EXISTS companies_insert_anon ON public.companies;
CREATE POLICY companies_insert_anon ON public.companies
  FOR INSERT TO anon
  WITH CHECK (true);
