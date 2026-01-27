-- Add flag for sending NPS survey on auto-close (separate from manual close)
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS satisfaction_survey_on_auto_close boolean DEFAULT true;

-- Set default value based on existing satisfaction_survey_enabled
UPDATE public.organizations 
SET satisfaction_survey_on_auto_close = satisfaction_survey_enabled 
WHERE satisfaction_survey_on_auto_close IS NULL;