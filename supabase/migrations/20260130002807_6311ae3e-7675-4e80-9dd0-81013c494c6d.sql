-- Add combo_id to storefront_products to support adding combos to storefronts
ALTER TABLE public.storefront_products
ADD COLUMN combo_id uuid REFERENCES public.product_combos(id) ON DELETE CASCADE;

-- Add constraint to ensure either product_id or combo_id is set, but not both
-- First, make product_id nullable since we now can have combos instead
ALTER TABLE public.storefront_products
ALTER COLUMN product_id DROP NOT NULL;

-- Add check constraint to ensure exactly one of product_id or combo_id is set
ALTER TABLE public.storefront_products
ADD CONSTRAINT storefront_products_product_or_combo_check
CHECK (
  (product_id IS NOT NULL AND combo_id IS NULL) OR
  (product_id IS NULL AND combo_id IS NOT NULL)
);

-- Create index for combo_id
CREATE INDEX idx_storefront_products_combo_id ON public.storefront_products(combo_id);

-- Add comment for clarity
COMMENT ON COLUMN public.storefront_products.combo_id IS 'Reference to product_combos. Either product_id or combo_id must be set, not both.';