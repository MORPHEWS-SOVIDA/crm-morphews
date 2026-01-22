-- Add separate transcription columns for team vs client audio (global organization settings)
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS whatsapp_transcribe_client_audio BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_transcribe_team_audio BOOLEAN DEFAULT false;

-- Migrate existing settings: if old flag was enabled, enable client transcription
UPDATE public.organizations 
SET whatsapp_transcribe_client_audio = whatsapp_audio_transcription_enabled
WHERE whatsapp_audio_transcription_enabled = true;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.whatsapp_transcribe_client_audio IS 'Transcrever automaticamente áudios recebidos de clientes (50 energia/áudio)';
COMMENT ON COLUMN public.organizations.whatsapp_transcribe_team_audio IS 'Transcrever automaticamente áudios enviados pela equipe (50 energia/áudio)';