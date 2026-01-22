-- Add audio transcription global setting to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS whatsapp_audio_transcription_enabled boolean NOT NULL DEFAULT false;