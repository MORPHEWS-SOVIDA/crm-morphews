-- Create storage bucket for landing page assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-assets', 'landing-assets', true);

-- Allow anyone to view landing assets (public bucket)
CREATE POLICY "Public access to landing assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing-assets');

-- Allow authenticated users to upload their own landing assets
CREATE POLICY "Authenticated users can upload landing assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'landing-assets' 
  AND auth.role() = 'authenticated'
);

-- Allow users to update their own uploads
CREATE POLICY "Users can update own landing assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'landing-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own landing assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'landing-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);