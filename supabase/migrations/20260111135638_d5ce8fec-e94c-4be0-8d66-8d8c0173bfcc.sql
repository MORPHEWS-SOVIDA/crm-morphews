-- Create storage bucket for bot avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow anyone to view avatars (public bucket)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Create policy for service role to upload
CREATE POLICY "Service role can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

-- Create policy for service role to update
CREATE POLICY "Service role can update avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');

-- Create policy for service role to delete
CREATE POLICY "Service role can delete avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars');