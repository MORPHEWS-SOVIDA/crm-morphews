
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS auto_message_media_url TEXT,
  ADD COLUMN IF NOT EXISTS auto_message_media_type TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('integration-media', 'integration-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read integration-media" ON storage.objects;
CREATE POLICY "Public read integration-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'integration-media');

DROP POLICY IF EXISTS "Authenticated upload integration-media" ON storage.objects;
CREATE POLICY "Authenticated upload integration-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'integration-media');

DROP POLICY IF EXISTS "Authenticated update integration-media" ON storage.objects;
CREATE POLICY "Authenticated update integration-media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'integration-media');

DROP POLICY IF EXISTS "Authenticated delete integration-media" ON storage.objects;
CREATE POLICY "Authenticated delete integration-media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'integration-media');
