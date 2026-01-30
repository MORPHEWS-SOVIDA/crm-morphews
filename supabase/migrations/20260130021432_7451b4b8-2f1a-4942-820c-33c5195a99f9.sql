-- Create storage bucket for storefront assets (banners, testimonials, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('storefront-assets', 'storefront-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their organization folder
CREATE POLICY "Authenticated users can upload storefront assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'storefront-assets');

-- Allow public read access for storefront assets
CREATE POLICY "Public read access for storefront assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'storefront-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update storefront assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'storefront-assets');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete storefront assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'storefront-assets');