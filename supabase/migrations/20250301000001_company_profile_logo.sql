-- Company profile: editable name and logo
-- Add logo_url to companies; name remains editable via app.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN logo_url text;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- companies table does not exist; create minimal one
    CREATE TABLE public.companies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      logo_url text,
      created_at timestamptz DEFAULT now()
    );
END $$;

COMMENT ON COLUMN public.companies.logo_url IS 'Public URL of company logo (e.g. Supabase Storage company-logos bucket).';
