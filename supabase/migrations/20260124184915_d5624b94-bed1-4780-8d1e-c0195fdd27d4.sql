-- Public access for storefront browsing (anon)

-- 1) tenant_storefronts: allow public read of active storefronts
DROP POLICY IF EXISTS "Public can view active storefronts" ON public.tenant_storefronts;
CREATE POLICY "Public can view active storefronts"
ON public.tenant_storefronts
FOR SELECT
TO anon
USING (is_active = true);

-- 2) storefront_products: allow public read of visible products from active storefronts
DROP POLICY IF EXISTS "Public can view visible storefront products" ON public.storefront_products;
CREATE POLICY "Public can view visible storefront products"
ON public.storefront_products
FOR SELECT
TO anon
USING (
  is_visible = true
  AND storefront_id IN (
    SELECT id FROM public.tenant_storefronts WHERE is_active = true
  )
);

-- 3) lead_products: allow public read of ecommerce-enabled products, but restrict columns via privileges
DROP POLICY IF EXISTS "Public can view ecommerce-enabled products" ON public.lead_products;
CREATE POLICY "Public can view ecommerce-enabled products"
ON public.lead_products
FOR SELECT
TO anon
USING (
  is_active = true
  AND ecommerce_enabled = true
  AND COALESCE(restrict_to_users, false) = false
);

-- Restrict what anon can read from lead_products (avoid exposing internal cost/tax fields)
REVOKE ALL ON TABLE public.lead_products FROM anon;
GRANT SELECT (
  id,
  name,
  description,
  image_url,
  ecommerce_title,
  ecommerce_description,
  ecommerce_short_description,
  ecommerce_images,
  ecommerce_video_url,
  ecommerce_benefits,
  base_price_cents,
  price_1_unit,
  price_3_units,
  price_6_units,
  price_12_units,
  crosssell_product_1_id,
  crosssell_product_2_id
) ON TABLE public.lead_products TO anon;
