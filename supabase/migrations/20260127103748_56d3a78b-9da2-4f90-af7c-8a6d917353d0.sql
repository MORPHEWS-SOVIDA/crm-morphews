-- Add attribution model to checkouts and landing pages
ALTER TABLE public.standalone_checkouts 
ADD COLUMN IF NOT EXISTS attribution_model text DEFAULT 'last_click' CHECK (attribution_model IN ('first_click', 'last_click'));

ALTER TABLE public.landing_pages 
ADD COLUMN IF NOT EXISTS attribution_model text DEFAULT 'last_click' CHECK (attribution_model IN ('first_click', 'last_click'));

-- Add comment explaining the models
COMMENT ON COLUMN public.standalone_checkouts.attribution_model IS 'first_click = affiliate from first visit wins, last_click = affiliate from last visit before purchase wins';
COMMENT ON COLUMN public.landing_pages.attribution_model IS 'first_click = affiliate from first visit wins, last_click = affiliate from last visit before purchase wins';