-- Update cart policy with affiliate visibility
DROP POLICY IF EXISTS "Tenant vê carrinhos" ON public.ecommerce_carts;

CREATE POLICY "Tenant vê carrinhos"
ON public.ecommerce_carts
FOR SELECT
USING (
  auth.uid() IS NULL
  OR
  public.is_tenant_member(auth.uid(), organization_id)
  OR
  public.user_is_affiliate_for_cart(auth.uid(), id)
);