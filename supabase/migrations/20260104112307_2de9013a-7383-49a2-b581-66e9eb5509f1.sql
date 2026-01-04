-- Create bucket for user profile avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'user-avatars');

CREATE POLICY "Authenticated users can update their avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'user-avatars');

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'user-avatars');

CREATE POLICY "Authenticated users can delete their avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'user-avatars');