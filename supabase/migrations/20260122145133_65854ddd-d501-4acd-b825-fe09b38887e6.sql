-- Add extended fiscal fields to lead_products for complete NFe/NFSe support
ALTER TABLE public.lead_products
  ADD COLUMN IF NOT EXISTS fiscal_cest TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_item_type TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_tax_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiscal_icms_base NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiscal_icms_st_base NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiscal_icms_st_value NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiscal_icms_own_value NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiscal_ipi_exception_code TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_pis_fixed NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiscal_cofins_fixed NUMERIC(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiscal_additional_info TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.lead_products.fiscal_cest IS 'Código Especificador da Substituição Tributária';
COMMENT ON COLUMN public.lead_products.fiscal_item_type IS 'Tipo do item fiscal (revenda, materia_prima, embalagem, etc)';
COMMENT ON COLUMN public.lead_products.fiscal_tax_percentage IS 'Percentual aproximado de tributos';
COMMENT ON COLUMN public.lead_products.fiscal_icms_base IS 'Valor base ICMS ST - retenção';
COMMENT ON COLUMN public.lead_products.fiscal_icms_st_base IS 'Valor ICMS ST para retenção';
COMMENT ON COLUMN public.lead_products.fiscal_icms_st_value IS 'Valor ICMS ST';
COMMENT ON COLUMN public.lead_products.fiscal_icms_own_value IS 'Valor ICMS próprio do substituto';
COMMENT ON COLUMN public.lead_products.fiscal_ipi_exception_code IS 'Código exceção da TIPI (IPI)';
COMMENT ON COLUMN public.lead_products.fiscal_pis_fixed IS 'Valor PIS fixo';
COMMENT ON COLUMN public.lead_products.fiscal_cofins_fixed IS 'Valor COFINS fixo';
COMMENT ON COLUMN public.lead_products.fiscal_additional_info IS 'Informações adicionais para nota fiscal';