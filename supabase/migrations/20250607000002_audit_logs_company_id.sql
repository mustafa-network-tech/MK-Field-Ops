-- Audit logs: tenant isolation. Only Company Manager sees their company's audit log (day of control).
-- Add company_id to audit_logs and restrict SELECT to CM with company_id = current user's company.

-- 1) Add company_id column (nullable first for backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.audit_logs ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Backfill: set company_id from actor's profile
UPDATE public.audit_logs al
SET company_id = p.company_id
FROM public.profiles p
WHERE p.id = al.actor_user_id AND al.company_id IS NULL;

-- 3) Set NOT NULL (only for new rows; leave legacy rows without company as-is by not adding NOT NULL if backfill left nulls)
-- So we keep company_id nullable for old rows; new inserts will always send company_id.

-- 4) Index for filtered queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON public.audit_logs(company_id, created_at DESC);

-- 5) RLS: only Company Manager can SELECT, and only rows for their company
DROP POLICY IF EXISTS audit_logs_select_by_role ON public.audit_logs;
CREATE POLICY audit_logs_select_company_manager_only
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'companyManager'
    AND audit_logs.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- 6) INSERT: ensure user can only insert with their own company_id
DROP POLICY IF EXISTS audit_logs_insert_own ON public.audit_logs;
CREATE POLICY audit_logs_insert_own
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND (company_id IS NULL OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  );

COMMENT ON COLUMN public.audit_logs.company_id IS 'Company this audit event belongs to. Only Company Manager can see their company log.';
