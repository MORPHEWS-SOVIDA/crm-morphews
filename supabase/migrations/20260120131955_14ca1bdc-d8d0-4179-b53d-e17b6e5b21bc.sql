-- Add is_featured column to non_purchase_reasons table
ALTER TABLE public.non_purchase_reasons 
ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.non_purchase_reasons.is_featured IS 'When true, the reason appears prominently at the top of the selection list';