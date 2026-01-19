-- Add personal profile fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS favorite_team TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.leads.birth_date IS 'Data de nascimento do lead';
COMMENT ON COLUMN public.leads.gender IS 'Gênero do lead (masculino, feminino, outro, prefiro_nao_informar)';
COMMENT ON COLUMN public.leads.favorite_team IS 'Time de futebol que o lead torce';