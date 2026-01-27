-- Adicionar campo closing_type nas tabelas existentes para suportar Motoboy e Transportadora

-- Adicionar coluna closing_type à tabela pickup_closings
ALTER TABLE public.pickup_closings 
ADD COLUMN IF NOT EXISTS closing_type TEXT NOT NULL DEFAULT 'pickup';

-- Atualizar constraint de status para incluir closing_type válidos
ALTER TABLE public.pickup_closings 
DROP CONSTRAINT IF EXISTS pickup_closings_closing_type_check;

ALTER TABLE public.pickup_closings 
ADD CONSTRAINT pickup_closings_closing_type_check 
CHECK (closing_type IN ('pickup', 'motoboy', 'carrier'));

-- Adicionar coluna closing_type à tabela de vendas do fechamento
ALTER TABLE public.pickup_closing_sales 
ADD COLUMN IF NOT EXISTS closing_type TEXT NOT NULL DEFAULT 'pickup';

-- Remover constraint de unicidade antiga (uma venda só pode estar em UM fechamento de CADA tipo)
ALTER TABLE public.pickup_closing_sales 
DROP CONSTRAINT IF EXISTS pickup_closing_sales_unique;

-- Nova constraint: uma venda só pode estar em um fechamento POR TIPO
ALTER TABLE public.pickup_closing_sales 
ADD CONSTRAINT pickup_closing_sales_unique_per_type UNIQUE (sale_id, closing_type);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pickup_closings_type ON public.pickup_closings(closing_type);
CREATE INDEX IF NOT EXISTS idx_pickup_closing_sales_type ON public.pickup_closing_sales(closing_type);