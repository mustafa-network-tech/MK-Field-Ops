-- =============================================================================
-- Migration: Campaigns, Vehicles, Equipment, Work Items, Materials
-- Bağımlılık: public.companies (20250101 veya 20250301 ile oluşturulmuş olmalı)
-- Bu tablolar şirket bazlı ana veri; RLS sonraki migration'da.
-- =============================================================================

-- Önce public.companies var mı kontrol et; yoksa net hata ver
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
    RAISE EXCEPTION '20250401000001: public.companies yok. Önce 20250101000001, 20250301000001, 20250302000001 migration''larını çalıştırın.';
  END IF;
END $$;

-- 1) Campaigns – şirket kampanyaları (proje grupları)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_company_id ON public.campaigns (company_id);
COMMENT ON TABLE public.campaigns IS 'Company campaigns; projects are linked to a campaign.';

-- 2) Vehicles – şirket araçları (ekiplere atanabilir)
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plate_number text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  description text
);
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id ON public.vehicles (company_id);
COMMENT ON TABLE public.vehicles IS 'Company vehicles; can be assigned to teams.';

-- 3) Equipment – ekipman (iş kaydında equipmentIds ile referans)
CREATE TABLE IF NOT EXISTS public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_equipment_company_id ON public.equipment (company_id);
COMMENT ON TABLE public.equipment IS 'Company equipment; referenced in job records.';

-- 4) Work Items – iş kalemleri (birim fiyat, birim türü)
CREATE TABLE IF NOT EXISTS public.work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  unit_type text NOT NULL,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_work_items_company_id ON public.work_items (company_id);
COMMENT ON TABLE public.work_items IS 'Work item definitions; unit price and type for job valuation.';

-- 5) Materials – basit malzeme kaydı (fiyat; bazı ekranlarda kullanılır)
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_materials_company_id ON public.materials (company_id);
COMMENT ON TABLE public.materials IS 'Legacy material records (code, price); material_stock is the main stock table.';
