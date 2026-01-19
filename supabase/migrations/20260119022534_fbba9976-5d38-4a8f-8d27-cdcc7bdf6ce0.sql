-- Add call recording and transcription fields to receptive_attendances
ALTER TABLE public.receptive_attendances
ADD COLUMN IF NOT EXISTS call_recording_url TEXT,
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS transcription_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS call_quality_score JSONB,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.receptive_attendances.call_recording_url IS 'URL to the call recording audio file';
COMMENT ON COLUMN public.receptive_attendances.transcription IS 'AI-generated transcription of the call';
COMMENT ON COLUMN public.receptive_attendances.transcription_status IS 'pending, processing, completed, failed';
COMMENT ON COLUMN public.receptive_attendances.call_quality_score IS 'JSON with AI analysis: { followed_script: boolean, offered_kits: boolean, ... }';
COMMENT ON COLUMN public.receptive_attendances.notes IS 'Manual notes about the attendance';