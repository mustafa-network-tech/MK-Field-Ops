-- =============================================================================
-- mk-score 00013 - Campaign/Project approval workflow (CM approval)
-- =============================================================================
-- Hedef:
--   - PM kampanya/proje olusturabilsin.
--   - PM olusturdugu kayitlar CM onayina tabi olsun.
--   - PM approval alanlarini (approval_status/approved_by/approved_at) degistiremesin.
--   - CM approval alanlarini yonetebilsin.
--
-- Not:
--   Bu migration mevcut semayi bozmadan idempotent calisir.
-- =============================================================================

-- 1) campaigns: workflow kolonlari
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaigns'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'created_by'
    ) THEN
      ALTER TABLE public.campaigns
        ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'approval_status'
    ) THEN
      ALTER TABLE public.campaigns
        ADD COLUMN approval_status text NOT NULL DEFAULT 'approved'
          CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'approved_by'
    ) THEN
      ALTER TABLE public.campaigns
        ADD COLUMN approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'approved_at'
    ) THEN
      ALTER TABLE public.campaigns
        ADD COLUMN approved_at timestamptz;
    END IF;
  END IF;
END $$;

-- 2) projects: workflow kolonlari (approval_status hali hazirda farkli anlamda kullaniliyorsa override etmeyelim)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'approval_status'
    ) THEN
      ALTER TABLE public.projects
        ADD COLUMN approval_status text NOT NULL DEFAULT 'approved'
          CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'approved_by'
    ) THEN
      ALTER TABLE public.projects
        ADD COLUMN approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'approved_at'
    ) THEN
      ALTER TABLE public.projects
        ADD COLUMN approved_at timestamptz;
    END IF;
  END IF;
END $$;

-- 3) PM approval alanlarini degistiremesin; CM status degisince approved_* otomatik yazilsin.
CREATE OR REPLACE FUNCTION public.enforce_campaign_project_approval_flow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  me_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO me_role FROM public.profiles WHERE id = auth.uid();

  IF me_role NOT IN ('companyManager', 'projectManager') THEN
    RAISE EXCEPTION 'Only CM/PM can mutate campaign/project rows'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'campaigns' THEN
      NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    END IF;

    IF me_role = 'projectManager' THEN
      NEW.approval_status := 'pending';
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    ELSE
      -- CM insert: default approved olarak normalize et
      IF NEW.approval_status IS NULL THEN
        NEW.approval_status := 'approved';
      END IF;
      IF NEW.approval_status = 'approved' THEN
        NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
        NEW.approved_at := COALESCE(NEW.approved_at, now());
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF me_role = 'projectManager' THEN
    IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Project manager cannot change approval fields'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- CM update: approval status degisince approved_* normalize et
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF NEW.approval_status IN ('approved', 'rejected') THEN
      NEW.approved_by := auth.uid();
      NEW.approved_at := now();
    ELSIF NEW.approval_status = 'pending' THEN
      NEW.approved_by := NULL;
      NEW.approved_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
    DROP TRIGGER IF EXISTS tr_campaigns_enforce_approval_flow ON public.campaigns;
    CREATE TRIGGER tr_campaigns_enforce_approval_flow
      BEFORE INSERT OR UPDATE ON public.campaigns
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_campaign_project_approval_flow();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    DROP TRIGGER IF EXISTS tr_projects_enforce_approval_flow ON public.projects;
    CREATE TRIGGER tr_projects_enforce_approval_flow
      BEFORE INSERT OR UPDATE ON public.projects
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_campaign_project_approval_flow();
  END IF;
END $$;

COMMENT ON FUNCTION public.enforce_campaign_project_approval_flow() IS
  'PM-created campaign/project rows are forced to pending; PM cannot mutate approval fields; CM controls approval.';
