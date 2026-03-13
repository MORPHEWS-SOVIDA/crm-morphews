-- Add shipping_method column to ecommerce_orders to store the shipping service name (e.g., Sedex, PAC, Motoboy)
ALTER TABLE public.ecommerce_orders ADD COLUMN IF NOT EXISTS shipping_method text;

-- Add default_seller_user_id to tenant_storefronts for auto-assigning seller on checkout
ALTER TABLE public.tenant_storefronts ADD COLUMN IF NOT EXISTS default_seller_user_id uuid;

COMMENT ON COLUMN public.ecommerce_orders.shipping_method IS 'Name of the shipping method chosen at checkout (e.g., Sedex, PAC, Motoboy)';
COMMENT ON COLUMN public.tenant_storefronts.default_seller_user_id IS 'Default seller user_id assigned to sales created from this storefront checkout';