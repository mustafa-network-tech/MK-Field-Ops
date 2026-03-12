-- =============================================================================
-- Migration: Material Stock, Team Material Allocations, Material Audit Log
-- Bağımlılık: companies, teams (allocations için)
-- material_stock: stok kalemleri (direk, kablo, boru, özel vb.)
-- team_material_allocations: ekip zimmeti (merkez -> ekip dağıtım)
-- material_audit_log: malzeme hareket denetim kayıtları
-- =============================================================================

-- 1) Material stock items – stok kalemleri (kablo metre/adet, spool, harici vb.)
CREATE TABLE IF NOT EXISTS public.material_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  main_type text NOT NULL,
  custom_group_name text,
  name text NOT NULL,
  size_or_capacity text,
  stock_qty numeric(12,2) CHECK (stock_qty IS NULL OR stock_qty >= 0),
  is_cable boolean DEFAULT false,
  cable_category text CHECK (cable_category IS NULL OR cable_category IN ('ic', 'yeraltı', 'havai')),
  capacity_label text,
  spool_id text,
  length_total numeric(12,2) CHECK (length_total IS NULL OR length_total >= 0),
  length_remaining numeric(12,2) CHECK (length_remaining IS NULL OR length_remaining >= 0),
  is_external boolean DEFAULT false,
  external_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_material_stock_company_id ON public.material_stock (company_id);
CREATE INDEX IF NOT EXISTS idx_material_stock_spool_id ON public.material_stock (company_id, spool_id) WHERE spool_id IS NOT NULL;
COMMENT ON TABLE public.material_stock IS 'Stock items: poles, cables (m/spool), pipes, etc.; team allocations reference this.';

-- 2) Team material allocations – ekip zimmeti (dağıtılan miktar)
CREATE TABLE IF NOT EXISTS public.team_material_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  material_stock_item_id uuid NOT NULL REFERENCES public.material_stock(id) ON DELETE RESTRICT,
  quantity_meters numeric(12,2) CHECK (quantity_meters IS NULL OR quantity_meters >= 0),
  quantity_pcs numeric(12,2) CHECK (quantity_pcs IS NULL OR quantity_pcs >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_allocation_quantity CHECK (
    (quantity_meters IS NOT NULL AND quantity_meters > 0) OR (quantity_pcs IS NOT NULL AND quantity_pcs > 0)
  )
);
CREATE INDEX IF NOT EXISTS idx_team_material_allocations_company_id ON public.team_material_allocations (company_id);
CREATE INDEX IF NOT EXISTS idx_team_material_allocations_team_id ON public.team_material_allocations (team_id);
CREATE INDEX IF NOT EXISTS idx_team_material_allocations_material ON public.team_material_allocations (material_stock_item_id);
COMMENT ON TABLE public.team_material_allocations IS 'Material allocated to teams (from central stock); job material usage can reference by team_zimmet_id.';

-- 3) Material audit log – malzeme hareket denetimi
CREATE TABLE IF NOT EXISTS public.material_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN (
    'STOCK_ADD', 'STOCK_EDIT', 'STOCK_DELETE', 'DISTRIBUTE_TO_TEAM',
    'RETURN_TO_STOCK', 'TRANSFER_BETWEEN_TEAMS', 'STOCK_ADJUSTMENT'
  )),
  actor_user_id uuid NOT NULL,
  actor_role text,
  material_stock_item_id uuid NOT NULL REFERENCES public.material_stock(id) ON DELETE CASCADE,
  from_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  to_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  qty_count numeric(12,2),
  qty_meters numeric(12,2),
  spool_id text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_material_audit_log_company_id ON public.material_audit_log (company_id);
CREATE INDEX IF NOT EXISTS idx_material_audit_log_created_at ON public.material_audit_log (company_id, created_at DESC);
COMMENT ON TABLE public.material_audit_log IS 'Audit trail for material movements (stock, distribute, return, transfer).';
