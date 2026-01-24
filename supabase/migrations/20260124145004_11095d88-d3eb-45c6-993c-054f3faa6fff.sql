-- Add more customization fields to storefront_products
ALTER TABLE public.storefront_products
ADD COLUMN IF NOT EXISTS custom_name TEXT,
ADD COLUMN IF NOT EXISTS custom_price_3_cents INTEGER,
ADD COLUMN IF NOT EXISTS custom_price_6_cents INTEGER,
ADD COLUMN IF NOT EXISTS custom_price_12_cents INTEGER;