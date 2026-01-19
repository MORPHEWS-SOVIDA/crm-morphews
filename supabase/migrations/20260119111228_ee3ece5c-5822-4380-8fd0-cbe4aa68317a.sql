-- Create storage bucket for receptive recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('receptive-recordings', 'receptive-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload receptive recordings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receptive-recordings');

-- RLS policy to allow authenticated users to read their org's recordings
CREATE POLICY "Authenticated users can read receptive recordings"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'receptive-recordings');

-- RLS policy to allow service role to delete after transcription
CREATE POLICY "Service role can delete receptive recordings"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'receptive-recordings');