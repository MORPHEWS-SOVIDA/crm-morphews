-- Add sales_hack field to product_price_kits for seller tips/scripts
ALTER TABLE public.product_price_kits
ADD COLUMN IF NOT EXISTS sales_hack TEXT;