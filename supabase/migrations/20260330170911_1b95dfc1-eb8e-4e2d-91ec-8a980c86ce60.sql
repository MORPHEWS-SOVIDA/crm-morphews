-- Add external_product_id to storefront_products for mapping external site product IDs
ALTER TABLE public.storefront_products ADD COLUMN external_product_id text;

-- Index for fast lookups during checkout resolution
CREATE INDEX idx_storefront_products_external_id ON public.storefront_products (external_product_id) WHERE external_product_id IS NOT NULL;

-- Allow RLS: public read access already exists for storefront_products