-- =============================================================================
-- Notifications: company-wide messages for CM/PM (e.g. new team created).
-- When PM/CM opens the app (any device), they fetch from Supabase and see + optional voice.
-- =============================================================================

-- Notifications table: one row per event (team created, job submitted, etc.)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  title_key text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_company_created ON public.notifications (company_id, created_at DESC);
COMMENT ON TABLE public.notifications IS 'Activity notifications for CM/PM; fetched when they open the app so they see on any device.';

-- Per-user read state so each manager marks as read independently
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads (user_id);
COMMENT ON TABLE public.notification_reads IS 'Which user has read which notification.';

-- RLS: same company can select notifications; authenticated same-company can insert (app creates on team create etc.); same company can manage reads for self
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_company ON public.notifications;
CREATE POLICY notifications_company ON public.notifications FOR ALL TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_reads_own ON public.notification_reads;
CREATE POLICY notification_reads_own ON public.notification_reads FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
