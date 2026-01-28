-- =====================================================
-- COMPLETE FIX: All missing functions + policies
-- =====================================================

-- 1. Create function for order affiliate check
CREATE OR REPLACE FUNCTION public.user_is_affiliate_for_order(_user_id uuid, _order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ecommerce_orders eo
    JOIN organization_affiliates oa ON eo.affiliate_id = oa.id
    WHERE eo.id = _order_id AND oa.user_id = _user_id
  );
$$;

-- 2. Create function for cart affiliate check
CREATE OR REPLACE FUNCTION public.user_is_affiliate_for_cart(_user_id uuid, _cart_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM ecommerce_carts ec
    JOIN organization_affiliates oa ON ec.affiliate_id = oa.id
    WHERE ec.id = _cart_id AND oa.user_id = _user_id
  );
$$;