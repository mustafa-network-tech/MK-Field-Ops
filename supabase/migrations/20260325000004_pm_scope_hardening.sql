-- =============================================================================
-- mk-score 00012 - PM scope hardening (phase 1)
-- =============================================================================
-- Hedef:
--   - PM operasyonel olarak yetkili kalsın (kampanya/proje/malzeme/irsaliye akislari).
--   - PM, kullanici yetki/uyelik alanlarini degistiremesin (CM-only).
--   - Irsaliye teslim alma (delivery note) PM tarafinda devam etsin.
--
-- Not:
--   "PM olusturdugu kampanya/proje CM onayina tabi" akisi icin ek kolon/is akisi
--   gereklidir; bu migration mevcut semayi bozmadan yetki daraltma yapar.
-- =============================================================================

-- 1) profiles: same-company toplu update yetkisi sadece CM olsun.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS profiles_update_cm_same_company ON public.profiles;
    CREATE POLICY profiles_update_cm_same_company
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
      company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
      AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'companyManager'
    )
    WITH CHECK (
      company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- 2) Operasyon tablolari: SELECT sirket-ici; yazma (I/U/D) CM + PM.
DO $$
BEGIN
  -- campaigns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaigns') THEN
    ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS campaigns_company ON public.campaigns;
    DROP POLICY IF EXISTS campaigns_select_company ON public.campaigns;
    DROP POLICY IF EXISTS campaigns_mutate_cm_pm ON public.campaigns;
    DROP POLICY IF EXISTS campaigns_mutate_cm_pm_upd ON public.campaigns;
    DROP POLICY IF EXISTS campaigns_mutate_cm_pm_del ON public.campaigns;

    CREATE POLICY campaigns_select_company ON public.campaigns
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY campaigns_mutate_cm_pm ON public.campaigns
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY campaigns_mutate_cm_pm_upd ON public.campaigns
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY campaigns_mutate_cm_pm_del ON public.campaigns
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;

  -- projects
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS projects_company ON public.projects;
    DROP POLICY IF EXISTS projects_select_company ON public.projects;
    DROP POLICY IF EXISTS projects_mutate_cm_pm ON public.projects;
    DROP POLICY IF EXISTS projects_mutate_cm_pm_upd ON public.projects;
    DROP POLICY IF EXISTS projects_mutate_cm_pm_del ON public.projects;

    CREATE POLICY projects_select_company ON public.projects
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY projects_mutate_cm_pm ON public.projects
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY projects_mutate_cm_pm_upd ON public.projects
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY projects_mutate_cm_pm_del ON public.projects
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;

  -- materials
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'materials') THEN
    ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS materials_company ON public.materials;
    DROP POLICY IF EXISTS materials_select_company ON public.materials;
    DROP POLICY IF EXISTS materials_mutate_cm_pm ON public.materials;
    DROP POLICY IF EXISTS materials_mutate_cm_pm_upd ON public.materials;
    DROP POLICY IF EXISTS materials_mutate_cm_pm_del ON public.materials;

    CREATE POLICY materials_select_company ON public.materials
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY materials_mutate_cm_pm ON public.materials
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY materials_mutate_cm_pm_upd ON public.materials
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY materials_mutate_cm_pm_del ON public.materials
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;

  -- material_stock
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_stock') THEN
    ALTER TABLE public.material_stock ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS material_stock_company ON public.material_stock;
    DROP POLICY IF EXISTS material_stock_select_company ON public.material_stock;
    DROP POLICY IF EXISTS material_stock_mutate_cm_pm ON public.material_stock;
    DROP POLICY IF EXISTS material_stock_mutate_cm_pm_upd ON public.material_stock;
    DROP POLICY IF EXISTS material_stock_mutate_cm_pm_del ON public.material_stock;

    CREATE POLICY material_stock_select_company ON public.material_stock
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY material_stock_mutate_cm_pm ON public.material_stock
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY material_stock_mutate_cm_pm_upd ON public.material_stock
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY material_stock_mutate_cm_pm_del ON public.material_stock
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;

  -- material_audit_log (okuma sirket ici, yazma CM/PM)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'material_audit_log') THEN
    ALTER TABLE public.material_audit_log ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS material_audit_log_company ON public.material_audit_log;
    DROP POLICY IF EXISTS material_audit_log_select_company ON public.material_audit_log;
    DROP POLICY IF EXISTS material_audit_log_insert_cm_pm ON public.material_audit_log;

    CREATE POLICY material_audit_log_select_company ON public.material_audit_log
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY material_audit_log_insert_cm_pm ON public.material_audit_log
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;

  -- delivery_notes (irsaliye): PM teslim alma yapabilsin => yazma CM/PM.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_notes') THEN
    ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS delivery_notes_company ON public.delivery_notes;
    DROP POLICY IF EXISTS delivery_notes_select_company ON public.delivery_notes;
    DROP POLICY IF EXISTS delivery_notes_mutate_cm_pm ON public.delivery_notes;
    DROP POLICY IF EXISTS delivery_notes_mutate_cm_pm_upd ON public.delivery_notes;
    DROP POLICY IF EXISTS delivery_notes_mutate_cm_pm_del ON public.delivery_notes;

    CREATE POLICY delivery_notes_select_company ON public.delivery_notes
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY delivery_notes_mutate_cm_pm ON public.delivery_notes
      FOR INSERT TO authenticated
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY delivery_notes_mutate_cm_pm_upd ON public.delivery_notes
      FOR UPDATE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
    CREATE POLICY delivery_notes_mutate_cm_pm_del ON public.delivery_notes
      FOR DELETE TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
      );
  END IF;

  -- delivery_note_items: parent delivery_note yetkisine bagli
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_note_items') THEN
    ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS delivery_note_items_via_note ON public.delivery_note_items;
    DROP POLICY IF EXISTS delivery_note_items_select_company ON public.delivery_note_items;
    DROP POLICY IF EXISTS delivery_note_items_mutate_cm_pm ON public.delivery_note_items;
    DROP POLICY IF EXISTS delivery_note_items_mutate_cm_pm_upd ON public.delivery_note_items;
    DROP POLICY IF EXISTS delivery_note_items_mutate_cm_pm_del ON public.delivery_note_items;

    CREATE POLICY delivery_note_items_select_company ON public.delivery_note_items
      FOR SELECT TO authenticated
      USING (
        delivery_note_id IN (
          SELECT dn.id
          FROM public.delivery_notes dn
          WHERE dn.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        )
      );

    CREATE POLICY delivery_note_items_mutate_cm_pm ON public.delivery_note_items
      FOR INSERT TO authenticated
      WITH CHECK (
        delivery_note_id IN (
          SELECT dn.id
          FROM public.delivery_notes dn
          WHERE dn.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
        )
      );
    CREATE POLICY delivery_note_items_mutate_cm_pm_upd ON public.delivery_note_items
      FOR UPDATE TO authenticated
      USING (
        delivery_note_id IN (
          SELECT dn.id
          FROM public.delivery_notes dn
          WHERE dn.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
        )
      )
      WITH CHECK (
        delivery_note_id IN (
          SELECT dn.id
          FROM public.delivery_notes dn
          WHERE dn.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
        )
      );
    CREATE POLICY delivery_note_items_mutate_cm_pm_del ON public.delivery_note_items
      FOR DELETE TO authenticated
      USING (
        delivery_note_id IN (
          SELECT dn.id
          FROM public.delivery_notes dn
          WHERE dn.company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
            AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('companyManager', 'projectManager')
        )
      );
  END IF;

  -- payroll_period_settings: yazma CM-only (PM belirleyemesin)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll_period_settings') THEN
    ALTER TABLE public.payroll_period_settings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS payroll_period_settings_company ON public.payroll_period_settings;
    DROP POLICY IF EXISTS payroll_period_settings_select_company ON public.payroll_period_settings;
    DROP POLICY IF EXISTS payroll_period_settings_mutate_cm_only ON public.payroll_period_settings;

    CREATE POLICY payroll_period_settings_select_company ON public.payroll_period_settings
      FOR SELECT TO authenticated
      USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

    CREATE POLICY payroll_period_settings_mutate_cm_only ON public.payroll_period_settings
      FOR ALL TO authenticated
      USING (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'companyManager'
      )
      WITH CHECK (
        company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
        AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'companyManager'
      );
  END IF;
END $$;
