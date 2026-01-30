-- Remove the redundant authenticated policy since "Users can view lead products" already handles org-based access
-- And we need to ensure ecommerce products are visible to authenticated users as well

-- First, drop the new policy we just created since it may conflict
DROP POLICY IF EXISTS "Authenticated users can view ecommerce products" ON public.lead_products;

-- Update the existing "Users can view lead products" policy to also include ecommerce products
DROP POLICY IF EXISTS "Users can view lead products" ON public.lead_products;

CREATE POLICY "Users can view lead products"
ON public.lead_products
FOR SELECT
TO authenticated
USING (
  -- Can see their organization's products
  organization_id = get_user_organization_id()
  -- OR can see public ecommerce products (for shopping in other storefronts)
  OR (is_active = true AND ecommerce_enabled = true AND COALESCE(restrict_to_users, false) = false)
);