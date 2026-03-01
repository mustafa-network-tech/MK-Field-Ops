-- MVP Audit Log: immutable "who did what, when" for critical actions.
-- Requires Supabase Auth (auth.uid()). For SELECT by role we use public.profiles (id = auth.uid(), role, company_id);
-- App should upsert into profiles on login so RLS can allow CM/PM to see all, TL to see own.

-- 1) Profiles: one row per auth user (id = auth.uid()). Populate on login for RLS.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  company_id uuid
);

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- 2) Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL,
  actor_email text,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  period_id uuid,
  team_code text,
  project_id text,
  user_agent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_period_id ON public.audit_logs(period_id);

-- 3) RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- INSERT: authenticated users can insert only their own logs (actor_user_id must equal auth.uid())
CREATE POLICY audit_logs_insert_own
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

-- SELECT: Company Manager & Project Manager see all; Team Leader sees only own (actor_user_id = auth.uid())
CREATE POLICY audit_logs_select_by_role
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        (p.role IN ('companyManager', 'projectManager'))
        OR (p.role = 'teamLeader' AND audit_logs.actor_user_id = auth.uid())
      )
    )
  );

-- No UPDATE or DELETE policies → logs are immutable

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail. INSERT only; no UPDATE/DELETE.';
