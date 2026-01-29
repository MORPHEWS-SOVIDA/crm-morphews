-- Add flexible custom kit pricing as JSONB to support dynamic kit quantities
-- Structure: { "2": 29700, "3": 39700, "5": 49700, ... } where key=quantity, value=price_cents

ALTER TABLE public.storefront_products
ADD COLUMN IF NOT EXISTS custom_kit_prices JSONB DEFAULT '{}';

COMMENT ON COLUMN public.storefront_products.custom_kit_prices IS 'Flexible custom prices for product kits. Keys are quantities (as strings), values are price in cents.';