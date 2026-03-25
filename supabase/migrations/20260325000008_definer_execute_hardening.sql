-- =============================================================================
-- mk-score 00016 - SECURITY DEFINER execute hardening
-- =============================================================================
-- Hedef:
--   SECURITY DEFINER fonksiyonlarinda varsayilan PUBLIC execute riskini kapatmak.
-- =============================================================================

-- get_company_id_by_join: onboarding akisi icin anon/authenticated cagirabilir.
REVOKE ALL ON FUNCTION public.get_company_id_by_join(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_company_id_by_join(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_company_id_by_join(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_id_by_join(text, text) TO anon, authenticated, service_role;

-- approve/reject join request: yalniz authenticated (fonksiyon icinde CM kontrolu var).
REVOKE ALL ON FUNCTION public.approve_join_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_join_request(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.approve_join_request(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reject_join_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_join_request(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reject_join_request(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reject_join_request(uuid) TO authenticated, service_role;

-- apply_pending_plan_if_due: application-side authenticated + service role.
REVOKE ALL ON FUNCTION public.apply_pending_plan_if_due(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_pending_plan_if_due(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.apply_pending_plan_if_due(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_pending_plan_if_due(uuid) TO authenticated, service_role;

-- try_claim_pending_signup: yalniz service role (kritik onboarding step).
REVOKE ALL ON FUNCTION public.try_claim_pending_signup(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_claim_pending_signup(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.try_claim_pending_signup(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.try_claim_pending_signup(uuid) TO service_role;

-- jobs_resolve_payroll_period: uygulama yazma akisinda authenticated gerekir.
REVOKE ALL ON FUNCTION public.jobs_resolve_payroll_period() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.jobs_resolve_payroll_period() FROM anon;
REVOKE ALL ON FUNCTION public.jobs_resolve_payroll_period() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.jobs_resolve_payroll_period() TO authenticated, service_role;

-- Trigger fonksiyonlari disariya acik cagrilmasin (savunma derinligi).
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_pending_signups_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_pending_signups_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_pending_signups_updated_at() FROM authenticated;
REVOKE ALL ON FUNCTION public.profiles_prevent_self_escalation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profiles_prevent_self_escalation() FROM anon;
REVOKE ALL ON FUNCTION public.profiles_prevent_self_escalation() FROM authenticated;
REVOKE ALL ON FUNCTION public.enforce_campaign_project_approval_flow() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_campaign_project_approval_flow() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_campaign_project_approval_flow() FROM authenticated;
