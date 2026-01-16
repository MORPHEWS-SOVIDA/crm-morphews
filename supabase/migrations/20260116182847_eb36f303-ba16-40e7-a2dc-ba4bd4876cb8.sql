-- Add evolution_settings column to store Evolution API configuration
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS evolution_settings jsonb DEFAULT NULL;