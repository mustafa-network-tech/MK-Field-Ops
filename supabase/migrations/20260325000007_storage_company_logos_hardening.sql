-- =============================================================================
-- mk-score 00015 - Storage hardening for company-logos bucket
-- =============================================================================
-- Hedef:
--   - Public read korunsun (logo gostermek icin).
--   - Public write/update/delete kapatilsin.
--   - Write/update/delete sadece authenticated CM/PM ve company-logos bucket altinda olsun.
-- =============================================================================

-- Eski acik politikalar temizlenir.
DROP POLICY IF EXISTS "company_logos_upload" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_update" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_delete" ON storage.objects;
DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;

-- Public read (yalniz select)
CREATE POLICY "company_logos_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Authenticated CM/PM upload
CREATE POLICY "company_logos_upload_cm_pm"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role IN ('companyManager', 'projectManager')
  )
);

-- Authenticated CM/PM update
CREATE POLICY "company_logos_update_cm_pm"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role IN ('companyManager', 'projectManager')
  )
)
WITH CHECK (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role IN ('companyManager', 'projectManager')
  )
);

-- Authenticated CM/PM delete
CREATE POLICY "company_logos_delete_cm_pm"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.role IN ('companyManager', 'projectManager')
  )
);
