-- Add invoice numbering and emission control fields to fiscal_companies
ALTER TABLE public.fiscal_companies
  ADD COLUMN IF NOT EXISTS nfe_environment TEXT DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS nfe_serie INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nfe_last_number INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nfse_environment TEXT DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS nfse_serie INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nfse_last_number INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_nature_operation TEXT DEFAULT 'Venda de mercadorias',
  ADD COLUMN IF NOT EXISTS presence_indicator TEXT DEFAULT '0';

-- Add comments for documentation
COMMENT ON COLUMN public.fiscal_companies.nfe_environment IS 'NFe emission environment: producao or homologacao';
COMMENT ON COLUMN public.fiscal_companies.nfe_serie IS 'NFe series number';
COMMENT ON COLUMN public.fiscal_companies.nfe_last_number IS 'Last NFe number emitted (to continue sequence)';
COMMENT ON COLUMN public.fiscal_companies.nfse_environment IS 'NFSe emission environment: producao or homologacao';
COMMENT ON COLUMN public.fiscal_companies.nfse_serie IS 'NFSe series number';
COMMENT ON COLUMN public.fiscal_companies.nfse_last_number IS 'Last NFSe number emitted (to continue sequence)';
COMMENT ON COLUMN public.fiscal_companies.default_nature_operation IS 'Default operation nature description';
COMMENT ON COLUMN public.fiscal_companies.presence_indicator IS 'Presence indicator for fiscal operations';