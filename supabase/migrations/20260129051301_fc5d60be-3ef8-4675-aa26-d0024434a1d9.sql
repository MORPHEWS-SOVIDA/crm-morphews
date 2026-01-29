
-- Fix FK constraint: ecommerce_orders.affiliate_id should reference organization_affiliates, not affiliates
-- Also fix ecommerce_carts.affiliate_id if needed

-- Drop the old FK
ALTER TABLE public.ecommerce_orders 
DROP CONSTRAINT IF EXISTS ecommerce_orders_affiliate_id_fkey;

-- Create new FK referencing organization_affiliates
ALTER TABLE public.ecommerce_orders
ADD CONSTRAINT ecommerce_orders_affiliate_id_fkey 
FOREIGN KEY (affiliate_id) REFERENCES public.organization_affiliates(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ecommerce_orders_affiliate_id 
ON public.ecommerce_orders(affiliate_id);
