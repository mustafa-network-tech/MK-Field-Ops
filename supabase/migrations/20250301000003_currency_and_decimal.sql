-- Currency and decimal(12,2) for money fields.
-- currency_code on company: optional override; when NULL, app uses locale (TR→TRY, EN→USD, ES/FR/DE→EUR).
-- All money columns should be decimal(12,2) for consistency and no floating-point drift.

-- 1) Companies: add currency_code for future manual override (e.g. 'USD', 'TRY', 'EUR')
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'companies' AND column_name = 'currency_code'
    ) THEN
      ALTER TABLE companies ADD COLUMN currency_code char(3) DEFAULT NULL;
      COMMENT ON COLUMN companies.currency_code IS 'Optional override. When NULL, app uses locale (TR→TRY, EN→USD, ES/FR/DE→EUR).';
    END IF;
  END IF;
END $$;

-- 2) work_items.unit_price: ensure numeric(12,2) if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_items') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_items' AND column_name = 'unit_price') THEN
      ALTER TABLE work_items ALTER COLUMN unit_price TYPE numeric(12,2) USING (round((unit_price)::numeric, 2));
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 3) jobs: if quantity is stored as integer, consider altering to numeric(12,2) for decimal quantities
-- DO $$
-- BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
--     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'quantity') THEN
--       ALTER TABLE jobs ALTER COLUMN quantity TYPE numeric(12,2) USING quantity::numeric(12,2);
--     END IF;
--   END IF;
-- END $$;
