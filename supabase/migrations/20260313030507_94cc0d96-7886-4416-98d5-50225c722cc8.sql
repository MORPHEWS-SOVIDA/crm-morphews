-- Function to check if a user is a coproducer for a given order's storefront
CREATE OR REPLACE FUNCTION public.user_is_coproducer_for_order(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM ecommerce_orders eo
    JOIN storefront_products sp ON sp.storefront_id = eo.storefront_id
    JOIN coproducers c ON c.product_id = sp.product_id AND c.is_active = true
    JOIN virtual_accounts va ON va.id = c.virtual_account_id
    JOIN profiles p ON p.partner_virtual_account_id = va.id
    WHERE eo.id = _order_id 
    AND p.user_id = _user_id
  );
$$;

-- Drop the old SELECT policy
DROP POLICY IF EXISTS "Users can view orders (full members OR attributed affiliate)" ON public.ecommerce_orders;

-- Create updated policy that also includes coproducers
CREATE POLICY "Users can view orders (members, affiliates, or coproducers)"
ON public.ecommerce_orders FOR SELECT
TO authenticated
USING (
  is_full_org_member(auth.uid(), organization_id) 
  OR user_is_affiliate_for_order(auth.uid(), id)
  OR user_is_coproducer_for_order(auth.uid(), id)
);