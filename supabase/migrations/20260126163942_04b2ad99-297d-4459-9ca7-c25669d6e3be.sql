-- Add full_html column to landing_pages for importing complete sites
ALTER TABLE public.landing_pages 
ADD COLUMN IF NOT EXISTS full_html TEXT,
ADD COLUMN IF NOT EXISTS import_mode TEXT DEFAULT 'structured' CHECK (import_mode IN ('structured', 'full_html')),
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.landing_pages.full_html IS 'Complete HTML of imported site for full-html mode';
COMMENT ON COLUMN public.landing_pages.import_mode IS 'structured = uses editor fields, full_html = uses raw HTML';
COMMENT ON COLUMN public.landing_pages.source_url IS 'Original URL if imported from external site';
COMMENT ON COLUMN public.landing_pages.branding IS 'Extracted branding info (colors, fonts, logo) from scraping';