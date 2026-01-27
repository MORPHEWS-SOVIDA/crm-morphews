-- Create storage bucket for quiz assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('quiz-assets', 'quiz-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Quiz assets are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'quiz-assets');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload quiz assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'quiz-assets' AND auth.role() = 'authenticated');

-- Allow users to update their uploads
CREATE POLICY "Authenticated users can update quiz assets"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'quiz-assets' AND auth.role() = 'authenticated');

-- Allow users to delete their uploads
CREATE POLICY "Authenticated users can delete quiz assets"
ON storage.objects
FOR DELETE
USING (bucket_id = 'quiz-assets' AND auth.role() = 'authenticated');