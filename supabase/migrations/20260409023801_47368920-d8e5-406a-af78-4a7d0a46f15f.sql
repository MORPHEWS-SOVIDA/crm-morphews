
-- Add deduplication cooldown and stage protection to integrations
ALTER TABLE public.integrations 
  ADD COLUMN IF NOT EXISTS dedup_cooldown_minutes integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stage_priority_override boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.integrations.dedup_cooldown_minutes IS 'Minutes to ignore duplicate webhooks for the same lead on this integration. NULL = disabled.';
COMMENT ON COLUMN public.integrations.stage_priority_override IS 'If false, webhooks cannot regress lead stage to a lower priority. If true, always update stage.';
