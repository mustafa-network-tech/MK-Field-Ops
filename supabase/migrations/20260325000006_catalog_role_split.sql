-- =============================================================================
-- mk-score 00014 - Catalog role split hardening
-- =============================================================================
-- Hedef:
--   - vehicles/equipment/work_items tablolarinda write sadece CM+PM olsun.
--   - teams ve team_material_allocations tablolarinda TL yazma yetkisi kapansin.
--   - TL bu tablolari sirketi icinde okuyabilsin (operasyon gorunurlugu).
-- =============================================================================

DO $$
BEGIN
  -- vehicles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
    ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS vehicles_company ON public.vehicles;
    DROP POLICY IF EXISTS vehicles_select_company ON public.vehicles;
    DROP POLICY IF EXISTS vehicles_mutate_cm_pm ON public.vehicles;
    DROP POLICY IF EXISTS vehicles_mutate_cm_pm_upd ON public.vehicles;
    DROP POLICY IF EXISTS vehicles_mutate_cm_pm_del ON public.vehicles;

    CREATE POLICY vehicles_select_company ON public.vehicles
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY vehicles_mutate_cm_pm ON public.vehicles
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY vehicles_mutate_cm_pm_upd ON public.vehicles
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY vehicles_mutate_cm_pm_del ON public.vehicles
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;

  -- equipment
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipment') THEN
    ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS equipment_company ON public.equipment;
    DROP POLICY IF EXISTS equipment_select_company ON public.equipment;
    DROP POLICY IF EXISTS equipment_mutate_cm_pm ON public.equipment;
    DROP POLICY IF EXISTS equipment_mutate_cm_pm_upd ON public.equipment;
    DROP POLICY IF EXISTS equipment_mutate_cm_pm_del ON public.equipment;

    CREATE POLICY equipment_select_company ON public.equipment
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY equipment_mutate_cm_pm ON public.equipment
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY equipment_mutate_cm_pm_upd ON public.equipment
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY equipment_mutate_cm_pm_del ON public.equipment
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;

  -- work_items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_items') THEN
    ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS work_items_company ON public.work_items;
    DROP POLICY IF EXISTS work_items_select_company ON public.work_items;
    DROP POLICY IF EXISTS work_items_mutate_cm_pm ON public.work_items;
    DROP POLICY IF EXISTS work_items_mutate_cm_pm_upd ON public.work_items;
    DROP POLICY IF EXISTS work_items_mutate_cm_pm_del ON public.work_items;

    CREATE POLICY work_items_select_company ON public.work_items
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY work_items_mutate_cm_pm ON public.work_items
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY work_items_mutate_cm_pm_upd ON public.work_items
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY work_items_mutate_cm_pm_del ON public.work_items
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;

  -- teams: TL write kapat, sirket-ici read acik
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teams') THEN
    ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS teams_company_or_leader ON public.teams;
    DROP POLICY IF EXISTS teams_select_company ON public.teams;
    DROP POLICY IF EXISTS teams_mutate_cm_pm ON public.teams;
    DROP POLICY IF EXISTS teams_mutate_cm_pm_upd ON public.teams;
    DROP POLICY IF EXISTS teams_mutate_cm_pm_del ON public.teams;

    CREATE POLICY teams_select_company ON public.teams
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY teams_mutate_cm_pm ON public.teams
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY teams_mutate_cm_pm_upd ON public.teams
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY teams_mutate_cm_pm_del ON public.teams
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;

  -- team_material_allocations: TL write kapat, sirket-ici read acik
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_material_allocations') THEN
    ALTER TABLE public.team_material_allocations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS team_material_allocations_company_or_leader ON public.team_material_allocations;
    DROP POLICY IF EXISTS team_material_allocations_select_company ON public.team_material_allocations;
    DROP POLICY IF EXISTS team_material_allocations_mutate_cm_pm ON public.team_material_allocations;
    DROP POLICY IF EXISTS team_material_allocations_mutate_cm_pm_upd ON public.team_material_allocations;
    DROP POLICY IF EXISTS team_material_allocations_mutate_cm_pm_del ON public.team_material_allocations;

    CREATE POLICY team_material_allocations_select_company ON public.team_material_allocations
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY team_material_allocations_mutate_cm_pm ON public.team_material_allocations
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY team_material_allocations_mutate_cm_pm_upd ON public.team_material_allocations
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY team_material_allocations_mutate_cm_pm_del ON public.team_material_allocations
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;
END $$;
