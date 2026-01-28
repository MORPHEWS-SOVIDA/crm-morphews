-- STEP 1: Add affiliate_id column to ecommerce_carts
ALTER TABLE public.ecommerce_carts 
ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.organization_affiliates(id);

-- STEP 2: Create index
CREATE INDEX IF NOT EXISTS idx_ecommerce_carts_affiliate_id ON public.ecommerce_carts(affiliate_id);