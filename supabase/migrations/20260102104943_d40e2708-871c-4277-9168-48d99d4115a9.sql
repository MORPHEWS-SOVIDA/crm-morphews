-- Adicionar coluna tiktok na tabela leads
ALTER TABLE public.leads 
ADD COLUMN tiktok text;

-- Adicionar coluna updated_by na tabela lead_product_answers para rastrear quem editou
ALTER TABLE public.lead_product_answers 
ADD COLUMN updated_by uuid REFERENCES auth.users(id);