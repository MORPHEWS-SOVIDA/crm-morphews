-- Add Focus NFe tokens per company (each company has its own tokens)
ALTER TABLE public.fiscal_companies
ADD COLUMN IF NOT EXISTS focus_nfe_token_homologacao TEXT,
ADD COLUMN IF NOT EXISTS focus_nfe_token_producao TEXT;

-- Add comment explaining the fields
COMMENT ON COLUMN public.fiscal_companies.focus_nfe_token_homologacao IS 'Token de homologação da empresa no Focus NFe (ambiente de testes)';
COMMENT ON COLUMN public.fiscal_companies.focus_nfe_token_producao IS 'Token de produção da empresa no Focus NFe (ambiente real)';