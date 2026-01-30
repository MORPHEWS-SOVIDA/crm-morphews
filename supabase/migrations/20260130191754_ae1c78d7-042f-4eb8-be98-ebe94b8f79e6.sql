-- Add fiscal registration fields to leads table for NF-e/NFS-e issuance to legal entities
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS inscricao_estadual_isento BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(20) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS inscricao_municipal_isento BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.leads.inscricao_estadual IS 'State registration number (IE) for legal entities';
COMMENT ON COLUMN public.leads.inscricao_estadual_isento IS 'Whether the entity is exempt from state registration';
COMMENT ON COLUMN public.leads.inscricao_municipal IS 'Municipal registration number (IM) for legal entities';
COMMENT ON COLUMN public.leads.inscricao_municipal_isento IS 'Whether the entity is exempt from municipal registration';