-- Add feature flag for WhatsApp DMs access per organization
ALTER TABLE public.organizations 
ADD COLUMN whatsapp_dms_enabled boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.whatsapp_dms_enabled IS 'Controls whether the organization can see and use WhatsApp DMs feature';