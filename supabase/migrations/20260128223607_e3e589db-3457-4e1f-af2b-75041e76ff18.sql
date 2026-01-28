
-- =====================================================
-- FIX: Partner visibility isolation
-- Partners should ONLY see records attributed to them
-- =====================================================

-- 1. Create helper function to check if user is a FULL member (not partner)
CREATE OR REPLACE FUNCTION public.is_full_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
    AND organization_id = _org_id
    AND role NOT IN ('partner_affiliate', 'partner_coproducer', 'partner_industry', 'partner_factory')
  );
$$;

-- 2. Update SALES RLS policy
DROP POLICY IF EXISTS "Users can view sales of their org" ON public.sales;

CREATE POLICY "Users can view sales (full members OR attributed affiliate)"
ON public.sales
FOR SELECT
TO authenticated
USING (
  public.is_full_org_member(auth.uid(), organization_id)
  OR
  public.user_is_affiliate_for_sale(auth.uid(), id)
);

-- 3. Update ECOMMERCE_ORDERS RLS policy
DROP POLICY IF EXISTS "Users can view org orders" ON public.ecommerce_orders;

CREATE POLICY "Users can view orders (full members OR attributed affiliate)"
ON public.ecommerce_orders
FOR SELECT
TO authenticated
USING (
  public.is_full_org_member(auth.uid(), organization_id)
  OR
  public.user_is_affiliate_for_order(auth.uid(), id)
);

-- 4. Update ECOMMERCE_CARTS RLS policy
DROP POLICY IF EXISTS "Tenant vê carrinhos" ON public.ecommerce_carts;

CREATE POLICY "Carts visible to full members OR attributed affiliate"
ON public.ecommerce_carts
FOR SELECT
USING (
  auth.uid() IS NULL  -- Public checkout flow
  OR
  public.is_full_org_member(auth.uid(), organization_id)
  OR
  public.user_is_affiliate_for_cart(auth.uid(), id)
);
