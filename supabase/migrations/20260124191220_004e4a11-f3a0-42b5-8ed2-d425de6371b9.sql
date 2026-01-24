
-- FIX: Allow anon role to view storefront-related public data

-- 1) storefront_templates: grant anon read
DROP POLICY IF EXISTS "Templates são públicos" ON public.storefront_templates;
CREATE POLICY "Public can view templates"
ON public.storefront_templates
FOR SELECT
TO anon, authenticated
USING (true);

-- 2) storefront_banners: grant anon read for active banners
DROP POLICY IF EXISTS "Public can view active banners" ON public.storefront_banners;
CREATE POLICY "Public can view active banners"
ON public.storefront_banners
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at >= now())
);

-- 3) storefront_pages: grant anon read for active pages
DROP POLICY IF EXISTS "Public can view active pages" ON public.storefront_pages;
CREATE POLICY "Public can view active pages"
ON public.storefront_pages
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 4) storefront_categories: grant anon read for active categories
DROP POLICY IF EXISTS "Public can view active categories" ON public.storefront_categories;
CREATE POLICY "Public can view active categories"
ON public.storefront_categories
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 5) Also ensure storefront_products and tenant_storefronts include authenticated
DROP POLICY IF EXISTS "Public can view active storefronts" ON public.tenant_storefronts;
CREATE POLICY "Public can view active storefronts"
ON public.tenant_storefronts
FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Public can view visible storefront products" ON public.storefront_products;
CREATE POLICY "Public can view visible storefront products"
ON public.storefront_products
FOR SELECT
TO anon, authenticated
USING (
  is_visible = true
  AND storefront_id IN (
    SELECT id FROM public.tenant_storefronts WHERE is_active = true
  )
);

-- 6) lead_products: also include authenticated for public columns
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
