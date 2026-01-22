-- Adicionar campos fiscais extras aos produtos
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_benefit_code TEXT;     -- Código do benefício fiscal na UF
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_icms_info TEXT;        -- Informações complementares do ICMS
ALTER TABLE public.lead_products ADD COLUMN IF NOT EXISTS fiscal_icms_fisco_info TEXT;  -- Informações adicionais de interesse do fisco do ICMS