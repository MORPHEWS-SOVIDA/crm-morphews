
-- Fix existing products that are in storefronts but have ecommerce_enabled = false
-- This is the root cause of products not being visible to anonymous users
UPDATE public.lead_products
SET ecommerce_enabled = true
WHERE id IN (
  SELECT DISTINCT product_id 
  FROM public.storefront_products 
  WHERE is_visible = true
)
AND ecommerce_enabled = false;

-- Create trigger to auto-enable ecommerce when product is added to a storefront
CREATE OR REPLACE FUNCTION public.auto_enable_ecommerce_on_storefront()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a product is added to a storefront, automatically enable ecommerce
  UPDATE public.lead_products
  SET ecommerce_enabled = true
  WHERE id = NEW.product_id
  AND ecommerce_enabled = false;
  
  RETURN NEW;
END;
$$;

-- Drop if exists to avoid conflicts
DROP TRIGGER IF EXISTS auto_enable_ecommerce_trigger ON public.storefront_products;

-- Create trigger on storefront_products insert
CREATE TRIGGER auto_enable_ecommerce_trigger
AFTER INSERT ON public.storefront_products
FOR EACH ROW
EXECUTE FUNCTION public.auto_enable_ecommerce_on_storefront();
