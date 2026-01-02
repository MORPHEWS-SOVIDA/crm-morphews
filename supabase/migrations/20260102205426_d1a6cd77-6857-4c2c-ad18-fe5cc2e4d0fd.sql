-- Adicionar pontos por tipo de preço (substituindo o campo points genérico)
ALTER TABLE public.product_price_kits 
ADD COLUMN points_regular integer DEFAULT 0,
ADD COLUMN points_promotional integer DEFAULT 0,
ADD COLUMN points_promotional_2 integer DEFAULT 0,
ADD COLUMN points_minimum integer DEFAULT 0,
ADD COLUMN usage_period_days integer DEFAULT NULL;

-- Migrar dados existentes do campo points para points_regular
UPDATE public.product_price_kits 
SET points_regular = COALESCE(points, 0);

-- Remover o campo points antigo
ALTER TABLE public.product_price_kits DROP COLUMN IF EXISTS points;