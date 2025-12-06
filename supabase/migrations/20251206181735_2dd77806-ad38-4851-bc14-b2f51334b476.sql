
-- O campo instagram está NOT NULL mas deveria ser nullable
-- Isso causa erro de RLS que na verdade é um erro de constraint
ALTER TABLE public.leads ALTER COLUMN instagram DROP NOT NULL;

-- Definir um default vazio para evitar problemas
ALTER TABLE public.leads ALTER COLUMN instagram SET DEFAULT '';
