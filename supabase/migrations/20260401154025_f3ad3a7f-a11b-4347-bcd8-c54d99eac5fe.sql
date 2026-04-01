-- Add external_site_url to storefronts
ALTER TABLE public.tenant_storefronts 
ADD COLUMN IF NOT EXISTS external_site_url text;

-- Add coupon tracking to sales
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS coupon_code text,
ADD COLUMN IF NOT EXISTS coupon_discount_cents integer DEFAULT 0;

-- Allow organization_affiliates to be queried by non-authenticated users for public registration
-- (the registration page needs to look up storefronts by slug)
CREATE POLICY "Anyone can read active storefronts by slug"
ON public.tenant_storefronts
FOR SELECT
USING (is_active = true);
