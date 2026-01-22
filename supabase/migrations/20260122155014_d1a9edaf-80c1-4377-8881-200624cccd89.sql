-- Add missing Focus NFe fields: responsible and accountant info
ALTER TABLE public.fiscal_companies 
ADD COLUMN IF NOT EXISTS responsible_name TEXT,
ADD COLUMN IF NOT EXISTS responsible_cpf TEXT,
ADD COLUMN IF NOT EXISTS accountant_cpf_cnpj TEXT;