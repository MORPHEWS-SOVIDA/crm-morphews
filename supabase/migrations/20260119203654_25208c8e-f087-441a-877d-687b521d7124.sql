-- Add phone permission column to whatsapp_instance_users
ALTER TABLE public.whatsapp_instance_users
ADD COLUMN IF NOT EXISTS can_use_phone boolean NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.whatsapp_instance_users.can_use_phone IS 'Whether user can use phone/call features for this instance';