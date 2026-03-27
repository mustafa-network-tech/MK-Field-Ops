-- =============================================================================
-- Oturum açmış kullanıcının profil.company_id ile şirket satırı (RLS bypass).
-- Proje müdürü vb. rollerde companies SELECT bazen 0 satır dönünce yerel store
-- boş kalıyordu; bu fonksiyon yalnızca kendi şirketini join ile döndürür.
--
-- Not: subscription_status / closure_* sütunları bazı ortamlarda companies
-- tablosunda yok (00018 migration eksik kaldıysa). Bu RPC yalnızca çekirdek
-- sütunları okur; kapanış alanları normal companies SELECT ile gelir.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_my_company_snapshot()
RETURNS TABLE (
  id uuid,
  language_code text,
  name text,
  logo_url text,
  plan text,
  plan_start_date timestamptz,
  plan_end_date timestamptz,
  pending_plan text,
  pending_plan_billing_cycle text,
  payroll_start_day int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    c.id,
    c.language_code,
    c.name,
    c.logo_url,
    c.plan,
    c.plan_start_date,
    c.plan_end_date,
    c.pending_plan,
    c.pending_plan_billing_cycle,
    c.payroll_start_day
  FROM public.profiles p
  INNER JOIN public.companies c ON c.id = p.company_id
  WHERE p.id = auth.uid()
    AND p.company_id IS NOT NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_company_snapshot() IS
  'auth.uid() profilindeki company_id ile companies satırı; header/sync için güvenli okuma.';

REVOKE ALL ON FUNCTION public.get_my_company_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_company_snapshot() TO authenticated;
