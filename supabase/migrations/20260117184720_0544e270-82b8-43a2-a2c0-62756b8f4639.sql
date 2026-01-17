-- Add SKU column to product_price_kits table
ALTER TABLE public.product_price_kits 
ADD COLUMN sku TEXT;

-- Create index for fast SKU lookup
CREATE INDEX idx_product_price_kits_sku ON public.product_price_kits(sku) WHERE sku IS NOT NULL;

-- Add unique constraint per organization (SKU must be unique within org)
CREATE UNIQUE INDEX idx_product_price_kits_sku_org ON public.product_price_kits(sku, organization_id) WHERE sku IS NOT NULL;