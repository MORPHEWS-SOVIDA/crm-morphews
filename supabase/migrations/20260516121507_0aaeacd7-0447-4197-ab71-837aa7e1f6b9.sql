ALTER TABLE public.lead_products
ADD COLUMN IF NOT EXISTS is_crossell BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.lead_products.is_crossell IS 'Quando true, vendas deste produto via webhook tentam ser agrupadas na venda mais recente (ultimos 60 min e em rascunho) do mesmo lead.';

CREATE INDEX IF NOT EXISTS idx_lead_products_is_crossell ON public.lead_products(is_crossell) WHERE is_crossell = true;