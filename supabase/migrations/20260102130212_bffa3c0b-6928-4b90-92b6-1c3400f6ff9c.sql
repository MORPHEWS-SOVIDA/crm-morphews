-- Add promotional_price_2 fields to product_price_kits
ALTER TABLE public.product_price_kits
ADD COLUMN promotional_price_2_cents integer,
ADD COLUMN promotional_2_use_default_commission boolean NOT NULL DEFAULT true,
ADD COLUMN promotional_2_custom_commission numeric;