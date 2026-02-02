-- Add logo_dark_url column for dark mode logo
ALTER TABLE public.white_label_configs 
ADD COLUMN IF NOT EXISTS logo_dark_url TEXT;