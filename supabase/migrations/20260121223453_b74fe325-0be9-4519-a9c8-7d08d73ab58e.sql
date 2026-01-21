-- Add cost_cents column to sale_items for tracking individual item costs (especially for manipulated products)
ALTER TABLE public.sale_items 
ADD COLUMN IF NOT EXISTS cost_cents integer DEFAULT NULL;

-- Add index for faster queries on requisition_number (manipulated products)
CREATE INDEX IF NOT EXISTS idx_sale_items_requisition_number 
ON public.sale_items(requisition_number) 
WHERE requisition_number IS NOT NULL;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.sale_items.cost_cents IS 'Cost in cents for this specific item. For manipulated products, this is entered manually per requisition.';
