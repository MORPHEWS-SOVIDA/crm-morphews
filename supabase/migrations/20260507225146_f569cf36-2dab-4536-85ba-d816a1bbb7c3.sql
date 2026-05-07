ALTER TABLE public.product_serial_labels
  ADD COLUMN IF NOT EXISTS lote text,
  ADD COLUMN IF NOT EXISTS validade text;

CREATE INDEX IF NOT EXISTS idx_psl_lote ON public.product_serial_labels(organization_id, lote) WHERE lote IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_psl_validade ON public.product_serial_labels(organization_id, validade) WHERE validade IS NOT NULL;