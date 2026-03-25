-- =============================================================================
-- mk-score 00011 - profiles self-update guard (critical)
-- =============================================================================
-- Amaç:
--   Kullanıcı kendi profile satırını güncellerken yetki/tenant alanlarını
--   değiştiremesin. (role, company_id, role_approval_status, can_see_prices)
--
-- Not:
--   Bu migration sadece "kendi profilini güncelleme" yolunu kilitler.
--   CM/PM ayrımı (başkasını güncelleme kapsamı) ayrı migration'da ele alınacaktır.
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Kendi satırını güncelleme politikası idempotent şekilde korunur.
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Kendi güncellemesinde kritik alan değişimini engelle.
CREATE OR REPLACE FUNCTION public.profiles_prevent_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Service role / backend işlemleri için auth.uid() null olabilir: bloklama yapma.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sadece kullanıcı kendi satırını güncelliyorsa kritik kolonlar sabit olmalı.
  IF OLD.id = auth.uid() THEN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.role_approval_status IS DISTINCT FROM OLD.role_approval_status
       OR NEW.can_see_prices IS DISTINCT FROM OLD.can_see_prices THEN
      RAISE EXCEPTION 'Self profile update cannot change company/role/approval/permissions fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_prevent_self_escalation ON public.profiles;
CREATE TRIGGER tr_profiles_prevent_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_prevent_self_escalation();

COMMENT ON FUNCTION public.profiles_prevent_self_escalation() IS
  'Blocks self-escalation on profiles: company_id, role, role_approval_status, can_see_prices.';
