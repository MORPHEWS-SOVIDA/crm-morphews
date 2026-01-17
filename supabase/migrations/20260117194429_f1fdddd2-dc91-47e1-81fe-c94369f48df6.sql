-- Make the scheduled-messages-media bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'scheduled-messages-media';

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Organizations can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Organizations can read media" ON storage.objects;
DROP POLICY IF EXISTS "Organizations can delete their media" ON storage.objects;

-- Create organization-scoped policies using the folder structure
-- Files are stored as: {organization_id}/{timestamp}_{filename}
-- The first folder in the path is the organization_id

CREATE POLICY "Org members can upload scheduled message media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'scheduled-messages-media'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org members can read their scheduled message media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'scheduled-messages-media'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org members can delete their scheduled message media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'scheduled-messages-media'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
);