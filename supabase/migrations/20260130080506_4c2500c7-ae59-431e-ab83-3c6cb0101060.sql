-- Add public access policy for product_price_kits
-- Allow anonymous users to view kits for products that are in any storefront

CREATE POLICY "Public can view product kits for storefront products"
ON public.product_price_kits
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.storefront_products sp
    JOIN public.tenant_storefronts ts ON ts.id = sp.storefront_id
    WHERE sp.product_id = product_price_kits.product_id
    AND ts.is_active = true
  )
);