-- Storage RLS: allow uploads and public read for company-logos bucket
-- Fixes: "new row violates row-level security policy" when uploading logos
-- Idempotent: drop first so migration can be re-run

DROP POLICY IF EXISTS "company_logos_upload" ON storage.objects;
CREATE POLICY "company_logos_upload"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_public_read" ON storage.objects;
CREATE POLICY "company_logos_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_update" ON storage.objects;
CREATE POLICY "company_logos_update"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "company_logos_delete" ON storage.objects;
CREATE POLICY "company_logos_delete"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'company-logos');
