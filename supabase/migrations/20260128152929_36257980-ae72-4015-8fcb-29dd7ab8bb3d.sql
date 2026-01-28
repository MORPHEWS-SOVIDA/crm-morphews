-- Permitir acesso público de leitura para landing pages ativas
CREATE POLICY "Public pode ver landing pages ativas"
ON public.landing_pages
FOR SELECT
USING (is_active = true);

-- Permitir acesso público de leitura para ofertas de landing pages ativas
CREATE POLICY "Public pode ver ofertas de landing pages ativas"
ON public.landing_offers
FOR SELECT
USING (
  landing_page_id IN (
    SELECT id FROM public.landing_pages WHERE is_active = true
  )
);