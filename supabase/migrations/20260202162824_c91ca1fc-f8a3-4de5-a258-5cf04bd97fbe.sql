-- Add dark theme color columns to white_label_configs
ALTER TABLE public.white_label_configs
ADD COLUMN IF NOT EXISTS primary_color_dark text DEFAULT '#A78BFA',
ADD COLUMN IF NOT EXISTS secondary_color_dark text DEFAULT '#1f1f1f';