-- Add global settings for image interpretation
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS whatsapp_image_interpretation boolean DEFAULT false;

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS whatsapp_image_medical_mode boolean DEFAULT false;

COMMENT ON COLUMN public.organizations.whatsapp_image_interpretation IS 'Enable global image interpretation for WhatsApp';
COMMENT ON COLUMN public.organizations.whatsapp_image_medical_mode IS 'Enable specialized medical prescription mode for image interpretation';