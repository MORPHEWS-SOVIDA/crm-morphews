
-- Add auto-message configuration columns to integrations table
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS auto_message_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_message_text text,
  ADD COLUMN IF NOT EXISTS auto_message_instance_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_message_rotation_enabled boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.integrations.auto_message_enabled IS 'Whether automatic WhatsApp message is enabled for this integration';
COMMENT ON COLUMN public.integrations.auto_message_text IS 'The automatic message template to send via WhatsApp';
COMMENT ON COLUMN public.integrations.auto_message_instance_ids IS 'Array of WhatsApp instance IDs to use for sending';
COMMENT ON COLUMN public.integrations.auto_message_rotation_enabled IS 'Whether to rotate between instances to reduce chip failures';
