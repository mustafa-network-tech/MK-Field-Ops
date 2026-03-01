-- Storage RLS: allow uploads and public read for company-logos bucket
-- Fixes: "new row violates row-level security policy" when uploading logos

-- Allow anon and authenticated to INSERT (upload) into company-logos bucket
CREATE POLICY "company_logos_upload"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'company-logos');

-- Allow public read so logo URLs work without signed links
CREATE POLICY "company_logos_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Optional: allow update/delete so app can replace or remove logos later
CREATE POLICY "company_logos_update"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'company-logos');

CREATE POLICY "company_logos_delete"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'company-logos');
