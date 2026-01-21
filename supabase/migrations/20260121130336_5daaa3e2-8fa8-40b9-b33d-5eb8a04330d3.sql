-- Add kit tracking fields to sale_items table
-- This enables the system to clearly distinguish between:
-- - Kit 12 × 1 = 12 units
-- - Kit 6 × 2 = 12 units
-- - Unit × 12 = 12 units

ALTER TABLE public.sale_items
ADD COLUMN IF NOT EXISTS kit_id UUID REFERENCES public.product_price_kits(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS kit_quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS multiplier INTEGER DEFAULT 1;

-- Add comment explaining the fields
COMMENT ON COLUMN public.sale_items.kit_id IS 'Reference to the product_price_kit that was sold';
COMMENT ON COLUMN public.sale_items.kit_quantity IS 'Number of units in the kit (e.g., 12 for Kit 12)';
COMMENT ON COLUMN public.sale_items.multiplier IS 'How many kits were ordered (e.g., 2 for Kit 6 × 2 = 12 units)';

-- Create index for kit lookups
CREATE INDEX IF NOT EXISTS idx_sale_items_kit_id ON public.sale_items(kit_id) WHERE kit_id IS NOT NULL;