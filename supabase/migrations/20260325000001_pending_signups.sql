-- =============================================================================
-- Pending SaaS signups: data before mock/real payment (Paddle webhook later).
-- Deploy Edge: create-pending-signup, mock-payment-success (--no-verify-jwt).
-- Shared logic: supabase/functions/_shared/activatePaidSignup.ts
-- =============================================================================

-- Optional: campaign display/join reference (4-digit), distinct from company join_code if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'join_code'
  ) THEN
    ALTER TABLE public.campaigns ADD COLUMN join_code char(4);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pending_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  campaign_name text NOT NULL,
  campaign_code char(4) NOT NULL,
  signup_token uuid NOT NULL DEFAULT gen_random_uuid(),
  selected_plan text,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'processing', 'completed', 'abandoned', 'failed')),
  activated_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  activated_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_signups_signup_token ON public.pending_signups (signup_token);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pending_signups_email_pending
  ON public.pending_signups (lower(trim(email)))
  WHERE status = 'pending_payment';

COMMENT ON TABLE public.pending_signups IS 'Pre-payment onboarding; completed after payment webhook/mock activates company+user.';

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role / SECURITY DEFINER used from Edge Functions

CREATE OR REPLACE FUNCTION public.set_pending_signups_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_pending_signups_updated_at ON public.pending_signups;
CREATE TRIGGER tr_pending_signups_updated_at
  BEFORE UPDATE ON public.pending_signups
  FOR EACH ROW EXECUTE FUNCTION public.set_pending_signups_updated_at();

-- Atomic claim for idempotent single activation (parallel requests: one wins)
CREATE OR REPLACE FUNCTION public.try_claim_pending_signup(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pending_signups
  SET status = 'processing', updated_at = now()
  WHERE id = p_id AND status = 'pending_payment';
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.try_claim_pending_signup(uuid) IS 'Sets pending_signups from pending_payment to processing; false if already taken or not pending.';

GRANT EXECUTE ON FUNCTION public.try_claim_pending_signup(uuid) TO service_role;
