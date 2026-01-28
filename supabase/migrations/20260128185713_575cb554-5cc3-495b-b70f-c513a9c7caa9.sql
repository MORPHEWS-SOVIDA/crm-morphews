-- Update sales and orders policies with affiliate visibility
DROP POLICY IF EXISTS "Users can view sales of their org" ON public.sales;
DROP POLICY IF EXISTS "Users can view org orders" ON public.ecommerce_orders;

-- SALES: Org members + Affiliates
CREATE POLICY "Users can view sales of their org"
ON public.sales
FOR SELECT
TO authenticated
USING (
  public.is_tenant_member(auth.uid(), organization_id)
  OR
  public.user_is_affiliate_for_sale(auth.uid(), id)
);

-- ECOMMERCE_ORDERS: Org members + Affiliates
CREATE POLICY "Users can view org orders"
ON public.ecommerce_orders
FOR SELECT
TO authenticated
USING (
  public.is_tenant_member(auth.uid(), organization_id)
  OR
  public.user_is_affiliate_for_order(auth.uid(), id)
);