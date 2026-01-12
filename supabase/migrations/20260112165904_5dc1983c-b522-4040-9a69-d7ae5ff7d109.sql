-- Add media fields to non_purchase_message_templates (templates)
ALTER TABLE public.non_purchase_message_templates
ADD COLUMN IF NOT EXISTS media_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS media_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS media_filename text DEFAULT NULL;

-- Add media fields to lead_scheduled_messages (scheduled messages)
ALTER TABLE public.lead_scheduled_messages
ADD COLUMN IF NOT EXISTS media_type text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS media_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS media_filename text DEFAULT NULL;

-- Add constraint to validate media_type values
COMMENT ON COLUMN public.non_purchase_message_templates.media_type IS 'Tipo de mídia: image, audio, document';
COMMENT ON COLUMN public.lead_scheduled_messages.media_type IS 'Tipo de mídia: image, audio, document';

-- Create storage bucket for scheduled message media
INSERT INTO storage.buckets (id, name, public)
VALUES ('scheduled-messages-media', 'scheduled-messages-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Organizations can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'scheduled-messages-media');

CREATE POLICY "Organizations can read media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'scheduled-messages-media');

CREATE POLICY "Organizations can delete their media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'scheduled-messages-media');