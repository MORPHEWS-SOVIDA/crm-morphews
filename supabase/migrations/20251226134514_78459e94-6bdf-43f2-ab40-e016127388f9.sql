-- Ensure whatsapp-media URLs are publicly fetchable and allow secure proxy fallback

-- 1) Short-lived tokens for media proxy
CREATE TABLE IF NOT EXISTS public.whatsapp_media_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  bucket_id TEXT NOT NULL DEFAULT 'whatsapp-media',
  object_path TEXT NOT NULL,
  content_type TEXT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_media_tokens_token ON public.whatsapp_media_tokens (token);
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_tokens_expires_at ON public.whatsapp_media_tokens (expires_at);

ALTER TABLE public.whatsapp_media_tokens ENABLE ROW LEVEL SECURITY;

-- No RLS policies: deny all for non-service roles. (Edge functions use service role.)

-- 2) Force bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'whatsapp-media';

-- 3) Public read policy for whatsapp-media objects
DO $$
BEGIN
  CREATE POLICY "Public read whatsapp-media"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'whatsapp-media');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
