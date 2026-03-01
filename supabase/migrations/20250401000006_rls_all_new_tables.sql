-- =============================================================================
-- RLS: Tüm yeni tablolar için çok kiracılı erişim kontrolü
-- Tablo yoksa atlanır (IF EXISTS); böylece 000001-000005 tam çalışmamış olsa da hata vermez.
-- =============================================================================

DO $rls$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
    ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS campaigns_company ON public.campaigns;
    CREATE POLICY campaigns_company ON public.campaigns FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
    ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS vehicles_company ON public.vehicles;
    CREATE POLICY vehicles_company ON public.vehicles FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipment') THEN
    ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS equipment_company ON public.equipment;
    CREATE POLICY equipment_company ON public.equipment FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_items') THEN
    ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS work_items_company ON public.work_items;
    CREATE POLICY work_items_company ON public.work_items FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materials') THEN
    ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS materials_company ON public.materials;
    CREATE POLICY materials_company ON public.materials FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teams') THEN
    ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS teams_company_or_leader ON public.teams;
    CREATE POLICY teams_company_or_leader ON public.teams FOR ALL TO authenticated
      USING (
        company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager') OR leader_id = auth.uid())
      )
      WITH CHECK (
        company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager') OR leader_id = auth.uid())
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS projects_company ON public.projects;
    CREATE POLICY projects_company ON public.projects FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_stock') THEN
    ALTER TABLE public.material_stock ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS material_stock_company ON public.material_stock;
    CREATE POLICY material_stock_company ON public.material_stock FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_material_allocations') THEN
    ALTER TABLE public.team_material_allocations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS team_material_allocations_company_or_leader ON public.team_material_allocations;
    CREATE POLICY team_material_allocations_company_or_leader ON public.team_material_allocations FOR ALL TO authenticated
      USING (
        company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      )
      WITH CHECK (
        company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_audit_log') THEN
    ALTER TABLE public.material_audit_log ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS material_audit_log_company ON public.material_audit_log;
    CREATE POLICY material_audit_log_company ON public.material_audit_log FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_notes') THEN
    ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS delivery_notes_company ON public.delivery_notes;
    CREATE POLICY delivery_notes_company ON public.delivery_notes FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_note_items') THEN
    ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS delivery_note_items_via_note ON public.delivery_note_items;
    CREATE POLICY delivery_note_items_via_note ON public.delivery_note_items FOR ALL TO authenticated
      USING (delivery_note_id IN (SELECT id FROM public.delivery_notes WHERE company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())))
      WITH CHECK (delivery_note_id IN (SELECT id FROM public.delivery_notes WHERE company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'jobs') THEN
    ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS jobs_company_or_leader ON public.jobs;
    CREATE POLICY jobs_company_or_leader ON public.jobs FOR ALL TO authenticated
      USING (
        company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      )
      WITH CHECK (
        company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid())
        AND ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
             OR team_id IN (SELECT id FROM public.teams WHERE company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()) AND leader_id = auth.uid()))
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_period_settings') THEN
    ALTER TABLE public.payroll_period_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS payroll_period_settings_company ON public.payroll_period_settings;
    CREATE POLICY payroll_period_settings_company ON public.payroll_period_settings FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_periods') THEN
    ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS payroll_periods_company ON public.payroll_periods;
    CREATE POLICY payroll_periods_company ON public.payroll_periods FOR ALL TO authenticated
      USING (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()))
      WITH CHECK (company_id = (SELECT company_id::text FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $rls$;
