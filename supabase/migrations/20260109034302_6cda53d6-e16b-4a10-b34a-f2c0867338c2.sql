-- Add result field to lead_followups for fun outcome tracking
ALTER TABLE public.lead_followups 
ADD COLUMN result TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.lead_followups.result IS 'Outcome of the followup: client_called_first, success, keep_trying, give_up';