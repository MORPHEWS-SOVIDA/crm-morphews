-- Add points field to product price kits for sales campaigns
ALTER TABLE public.product_price_kits
ADD COLUMN points integer DEFAULT 0;