-- Create storage bucket for shipping labels
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shipping-labels', 'shipping-labels', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read access for shipping labels"
ON storage.objects FOR SELECT
USING (bucket_id = 'shipping-labels');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload shipping labels"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'shipping-labels' AND auth.role() = 'authenticated');

-- Service role can manage all files (for edge functions)
CREATE POLICY "Service role can manage shipping labels"
ON storage.objects FOR ALL
USING (bucket_id = 'shipping-labels')
WITH CHECK (bucket_id = 'shipping-labels');