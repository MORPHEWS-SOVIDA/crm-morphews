-- Add sender name prefix global setting
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS whatsapp_sender_name_prefix_enabled boolean NOT NULL DEFAULT false;