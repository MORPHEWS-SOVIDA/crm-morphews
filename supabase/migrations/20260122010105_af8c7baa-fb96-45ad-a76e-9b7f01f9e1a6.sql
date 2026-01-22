-- =============================================
-- Add Bot Fallback fields to non_purchase_message_templates
-- When a follow-up message is sent and no seller claims the conversation
-- within X minutes, a specified bot can take over
-- =============================================

-- Add new columns for bot fallback functionality
ALTER TABLE public.non_purchase_message_templates
ADD COLUMN IF NOT EXISTS fallback_bot_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fallback_bot_id UUID REFERENCES public.ai_bots(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fallback_timeout_minutes INTEGER DEFAULT 30;

-- Add comment for documentation
COMMENT ON COLUMN public.non_purchase_message_templates.fallback_bot_enabled IS 'If true, a bot will take over if no seller claims within timeout';
COMMENT ON COLUMN public.non_purchase_message_templates.fallback_bot_id IS 'The AI bot to activate if no seller claims the conversation';
COMMENT ON COLUMN public.non_purchase_message_templates.fallback_timeout_minutes IS 'Minutes to wait before bot takes over (default 30)';

-- Also need to track which scheduled message triggered this for the bot activation job
ALTER TABLE public.lead_scheduled_messages
ADD COLUMN IF NOT EXISTS fallback_bot_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fallback_bot_id UUID REFERENCES public.ai_bots(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fallback_timeout_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS fallback_triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS fallback_status TEXT DEFAULT NULL;

-- Add index for querying pending fallbacks
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_fallback_pending
ON public.lead_scheduled_messages(status, fallback_bot_enabled, fallback_triggered_at)
WHERE status = 'sent' AND fallback_bot_enabled = true AND fallback_triggered_at IS NULL;