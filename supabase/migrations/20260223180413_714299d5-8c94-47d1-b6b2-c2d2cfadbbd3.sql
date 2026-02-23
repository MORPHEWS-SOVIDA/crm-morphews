-- Add fields to track sales modified during closing
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS modified_at_closing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS closing_modification_reason text,
ADD COLUMN IF NOT EXISTS closing_modified_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS closing_modified_at timestamptz;