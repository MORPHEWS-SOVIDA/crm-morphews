-- Add field for manual close NPS survey
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS satisfaction_survey_on_manual_close boolean DEFAULT true;