-- Add TikTok Click ID column for attribution tracking
ALTER TABLE public.ecommerce_carts 
ADD COLUMN IF NOT EXISTS ttclid TEXT;

-- Add index for click ID lookups
CREATE INDEX IF NOT EXISTS idx_ecommerce_carts_ttclid ON public.ecommerce_carts(ttclid) WHERE ttclid IS NOT NULL;

COMMENT ON COLUMN public.ecommerce_carts.ttclid IS 'TikTok Click ID for conversion tracking (CAPI)';