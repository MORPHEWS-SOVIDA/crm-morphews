-- =====================================================
-- FIX: Update function using only existing tables
-- =====================================================

-- Helper function: Check if user is affiliate for a sale (FIXED V2)
CREATE OR REPLACE FUNCTION public.user_is_affiliate_for_sale(_user_id uuid, _sale_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check affiliate_attributions (legacy affiliates table)
    SELECT 1 FROM affiliate_attributions aa
    JOIN affiliates a ON aa.affiliate_id = a.id
    JOIN virtual_accounts va ON a.virtual_account_id = va.id
    WHERE aa.sale_id = _sale_id AND va.user_id = _user_id
    
    UNION
    
    -- Check ecommerce_orders.affiliate_id (organization_affiliates V2)
    SELECT 1 FROM ecommerce_orders eo
    JOIN organization_affiliates oa ON eo.affiliate_id = oa.id
    WHERE eo.sale_id = _sale_id AND oa.user_id = _user_id
  );
$$;