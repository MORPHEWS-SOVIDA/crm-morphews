-- Add columns for fallback instance chain
ALTER TABLE public.lead_scheduled_messages 
ADD COLUMN IF NOT EXISTS fallback_instance_ids uuid[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_instance_index integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 3;

-- Create index for faster querying of failed messages
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_failed 
ON public.lead_scheduled_messages (organization_id, status) 
WHERE status IN ('failed_offline', 'failed_other');

-- Create index for pending messages that need processing
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending_schedule
ON public.lead_scheduled_messages (scheduled_at, status)
WHERE status = 'pending' AND deleted_at IS NULL;

-- Add comment explaining the fallback system
COMMENT ON COLUMN public.lead_scheduled_messages.fallback_instance_ids IS 'Array of WhatsApp instance IDs to try in order if primary fails';
COMMENT ON COLUMN public.lead_scheduled_messages.attempt_count IS 'Number of send attempts made';
COMMENT ON COLUMN public.lead_scheduled_messages.current_instance_index IS 'Current index in the fallback_instance_ids array';
COMMENT ON COLUMN public.lead_scheduled_messages.last_attempt_at IS 'Timestamp of last send attempt';
COMMENT ON COLUMN public.lead_scheduled_messages.max_attempts IS 'Maximum number of retry attempts';