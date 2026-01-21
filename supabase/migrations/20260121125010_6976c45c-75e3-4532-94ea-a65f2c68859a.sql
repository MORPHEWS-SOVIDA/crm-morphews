-- Add sac_default_description field to integrations table
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS sac_default_description text;