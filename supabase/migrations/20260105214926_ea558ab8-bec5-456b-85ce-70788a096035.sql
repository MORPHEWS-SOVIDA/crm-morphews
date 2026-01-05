
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Owners can manage lead products" ON public.lead_products;

-- Create a new policy that allows users with products_manage permission to manage products
CREATE POLICY "Users with products_manage can manage lead products"
ON public.lead_products
FOR ALL
USING (
  organization_id = get_user_organization_id()
  AND (
    -- Owner can always manage
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = lead_products.organization_id
        AND om.role = 'owner'
    )
    OR
    -- Users with products_manage permission can manage
    EXISTS (
      SELECT 1 FROM user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.organization_id = lead_products.organization_id
        AND up.products_manage = true
    )
  )
)
WITH CHECK (
  organization_id = get_user_organization_id()
  AND (
    -- Owner can always manage
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = lead_products.organization_id
        AND om.role = 'owner'
    )
    OR
    -- Users with products_manage permission can manage
    EXISTS (
      SELECT 1 FROM user_permissions up
      WHERE up.user_id = auth.uid()
        AND up.organization_id = lead_products.organization_id
        AND up.products_manage = true
    )
  )
);
