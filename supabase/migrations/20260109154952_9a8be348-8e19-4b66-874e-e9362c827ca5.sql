-- Add display name field for team visibility in chat
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS display_name_for_team TEXT;