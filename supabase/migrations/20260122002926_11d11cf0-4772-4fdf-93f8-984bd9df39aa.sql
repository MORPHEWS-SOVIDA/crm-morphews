-- Add whatsapp_ai_settings_view permission column
ALTER TABLE public.user_permissions
ADD COLUMN IF NOT EXISTS whatsapp_ai_settings_view boolean DEFAULT false;

COMMENT ON COLUMN public.user_permissions.whatsapp_ai_settings_view IS 'Can view and edit global WhatsApp AI settings';