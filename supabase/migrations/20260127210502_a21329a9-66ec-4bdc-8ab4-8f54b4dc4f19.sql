-- Add checkout_selectors column to store CSS selectors that trigger checkout modal
ALTER TABLE public.landing_pages 
ADD COLUMN IF NOT EXISTS checkout_selectors TEXT[] DEFAULT ARRAY['a[href*="comprar"]', 'a[href*="checkout"]', 'button:contains("COMPRAR")', '.checkout-button', '.buy-button', '.comprar-btn']::TEXT[];

COMMENT ON COLUMN public.landing_pages.checkout_selectors IS 'CSS selectors that should open the checkout modal when clicked (for full_html mode)';