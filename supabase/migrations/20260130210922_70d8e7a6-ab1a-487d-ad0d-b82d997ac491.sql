-- Drop and recreate the policy for anon access to lead_products
-- Ensure anonymous users can view ecommerce-enabled products

DROP POLICY IF EXISTS "Public can view ecommerce-enabled products" ON public.lead_products;

-- Create policy explicitly for anon role
CREATE POLICY "Public can view ecommerce-enabled products"
ON public.lead_products
FOR SELECT
TO anon
USING (
  is_active = true 
  AND ecommerce_enabled = true 
  AND COALESCE(restrict_to_users, false) = false
);

-- Also add policy for authenticated users to view the same products
-- (in addition to their organization's products)
CREATE POLICY "Authenticated users can view ecommerce products"
ON public.lead_products
FOR SELECT
TO authenticated
USING (
  (is_active = true AND ecommerce_enabled = true AND COALESCE(restrict_to_users, false) = false)
  OR organization_id = get_user_organization_id()
);