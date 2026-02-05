-- Add channel_type to non_purchase_message_templates to support SMS
ALTER TABLE public.non_purchase_message_templates 
ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel_type IN ('whatsapp', 'sms'));

-- Add comment for clarity
COMMENT ON COLUMN public.non_purchase_message_templates.channel_type IS 'Channel for sending: whatsapp or sms';

-- Add channel_type to lead_scheduled_messages
ALTER TABLE public.lead_scheduled_messages 
ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel_type IN ('whatsapp', 'sms'));

-- Add SMS-specific fields to lead_scheduled_messages
ALTER TABLE public.lead_scheduled_messages 
ADD COLUMN IF NOT EXISTS sms_phone TEXT;

COMMENT ON COLUMN public.lead_scheduled_messages.channel_type IS 'Channel for sending: whatsapp or sms';
COMMENT ON COLUMN public.lead_scheduled_messages.sms_phone IS 'Phone number for SMS sending (formatted)';