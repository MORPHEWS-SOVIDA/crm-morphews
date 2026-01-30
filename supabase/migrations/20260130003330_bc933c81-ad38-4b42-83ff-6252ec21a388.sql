-- Add missing columns to discount_coupons table
ALTER TABLE public.discount_coupons
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS applies_to text DEFAULT 'all',
ADD COLUMN IF NOT EXISTS product_ids uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS combo_ids uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS valid_from timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS max_uses_per_customer integer,
ADD COLUMN IF NOT EXISTS min_order_cents integer,
ADD COLUMN IF NOT EXISTS allow_with_affiliate boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS affiliate_only boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_attribute_affiliate_id uuid REFERENCES public.organization_affiliates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Rename discount_value_cents to discount_value for consistency (if it exists)
-- First check if we need to keep it as is or add alias
-- Actually, let's just add discount_value as an alias approach - we'll use discount_value_cents

-- Update existing records to have a name if null
UPDATE public.discount_coupons SET name = code WHERE name IS NULL;

-- Add check constraints
ALTER TABLE public.discount_coupons 
DROP CONSTRAINT IF EXISTS discount_coupons_discount_type_check;

ALTER TABLE public.discount_coupons
ADD CONSTRAINT discount_coupons_discount_type_check 
CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'fixed'));

ALTER TABLE public.discount_coupons
DROP CONSTRAINT IF EXISTS discount_coupons_applies_to_check;

ALTER TABLE public.discount_coupons
ADD CONSTRAINT discount_coupons_applies_to_check 
CHECK (applies_to IS NULL OR applies_to IN ('all', 'specific_products', 'specific_combos', 'specific_items'));

-- Create coupon_usages table if not exists
CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES public.discount_coupons(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  cart_id uuid REFERENCES public.ecommerce_carts(id) ON DELETE SET NULL,
  customer_email text,
  customer_phone text,
  discount_cents integer NOT NULL,
  attributed_affiliate_id uuid REFERENCES public.organization_affiliates(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate
DROP POLICY IF EXISTS "Users can view coupons from their organization" ON public.discount_coupons;
DROP POLICY IF EXISTS "Users can create coupons for their organization" ON public.discount_coupons;
DROP POLICY IF EXISTS "Users can update coupons from their organization" ON public.discount_coupons;
DROP POLICY IF EXISTS "Users can delete coupons from their organization" ON public.discount_coupons;
DROP POLICY IF EXISTS "Anyone can validate active coupons" ON public.discount_coupons;

CREATE POLICY "Users can view coupons from their organization"
ON public.discount_coupons FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
  OR is_active = true
);

CREATE POLICY "Users can create coupons for their organization"
ON public.discount_coupons FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update coupons from their organization"
ON public.discount_coupons FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete coupons from their organization"
ON public.discount_coupons FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Coupon usages policies
DROP POLICY IF EXISTS "Users can view coupon usages from their organization" ON public.coupon_usages;
DROP POLICY IF EXISTS "Anyone can register coupon usage" ON public.coupon_usages;

CREATE POLICY "Users can view coupon usages from their organization"
ON public.coupon_usages FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can register coupon usage"
ON public.coupon_usages FOR INSERT
WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_discount_coupons_org ON public.discount_coupons(organization_id);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_code ON public.discount_coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon ON public.coupon_usages(coupon_id);

-- Add coupon columns to ecommerce_carts if not exists
ALTER TABLE public.ecommerce_carts
ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.discount_coupons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS coupon_discount_cents integer DEFAULT 0;