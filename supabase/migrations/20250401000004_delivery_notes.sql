-- =============================================================================
-- Migration: Delivery Notes, Delivery Note Items
-- Bağımlılık: companies, material_stock
-- İrsaliye: teslim alındığında oluşturulur; kalemler stok kalemi + miktar.
-- =============================================================================

-- 1) Delivery notes – irsaliye başlığı
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  supplier text NOT NULL,
  received_date date NOT NULL,
  irsaliye_no text NOT NULL,
  received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_company_id ON public.delivery_notes (company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_received_date ON public.delivery_notes (company_id, received_date DESC);
COMMENT ON TABLE public.delivery_notes IS 'Delivery notes (irsaliye); immutable after receive.';

-- 2) Delivery note items – irsaliye kalemleri (stok kalemi + miktar + birim)
CREATE TABLE IF NOT EXISTS public.delivery_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id uuid NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  material_stock_item_id uuid NOT NULL REFERENCES public.material_stock(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  quantity_unit text NOT NULL CHECK (quantity_unit IN ('m', 'pcs')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_delivery_note_id ON public.delivery_note_items (delivery_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_material ON public.delivery_note_items (material_stock_item_id);
COMMENT ON TABLE public.delivery_note_items IS 'Line items of a delivery note; link to material_stock and quantity.';
