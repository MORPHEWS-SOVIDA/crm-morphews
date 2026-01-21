-- Add transcription column to whatsapp_messages
ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN public.whatsapp_messages.transcription IS 'AI-generated transcription of audio messages';
COMMENT ON COLUMN public.whatsapp_messages.transcription_status IS 'pending, processing, completed, failed';

-- Add auto-transcription settings to whatsapp_instances
ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS auto_transcribe_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_transcribe_inbound BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS auto_transcribe_outbound BOOLEAN DEFAULT TRUE;

-- Add comments
COMMENT ON COLUMN public.whatsapp_instances.auto_transcribe_enabled IS 'Enable automatic transcription of audio messages';
COMMENT ON COLUMN public.whatsapp_instances.auto_transcribe_inbound IS 'Transcribe audio received from clients';
COMMENT ON COLUMN public.whatsapp_instances.auto_transcribe_outbound IS 'Transcribe audio sent by team members';

-- Create index for searching transcriptions
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_transcription 
ON public.whatsapp_messages USING gin(to_tsvector('portuguese', COALESCE(transcription, '')))
WHERE transcription IS NOT NULL;