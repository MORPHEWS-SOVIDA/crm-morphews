-- Add ai_energy_balance column to organizations for AI energy tracking
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS ai_energy_balance INTEGER DEFAULT 1000;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.ai_energy_balance IS 'Saldo de energia IA disponível para transcrições e outras operações de IA';