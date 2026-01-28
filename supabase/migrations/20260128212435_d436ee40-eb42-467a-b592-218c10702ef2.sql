
-- Add factory_id column to sale_splits table
ALTER TABLE public.sale_splits 
ADD COLUMN factory_id UUID REFERENCES public.factories(id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_sale_splits_factory_id ON public.sale_splits(factory_id);
