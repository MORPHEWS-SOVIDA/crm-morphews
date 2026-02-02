-- Add page title field to white_label_configs
ALTER TABLE public.white_label_configs
ADD COLUMN IF NOT EXISTS page_title text;